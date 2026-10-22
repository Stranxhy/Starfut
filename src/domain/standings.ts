// Cálculo de la tabla general a partir de resultados oficiales.
// Las estadísticas se reconstruyen completas en cada cálculo: guardar dos veces
// el mismo resultado nunca duplica puntos ni goles.

import { outcomeFor, type ScoringRules, type ValidatedResult } from "./scoring";

export const TIEBREAK_CRITERIA = {
  PUNTOS: "Mayor cantidad de puntos",
  DIFERENCIA_GOLES: "Mejor diferencia de goles",
  GOLES_FAVOR: "Mayor cantidad de goles a favor",
  ENFRENTAMIENTO_DIRECTO: "Puntos en enfrentamientos directos entre los empatados",
  DIFERENCIA_DIRECTA: "Diferencia de goles en enfrentamientos directos",
  MENOS_GOLES_CONTRA: "Menos goles en contra",
  MAS_VICTORIAS: "Más victorias en tiempo regular",
  MENOS_DERROTAS: "Menos derrotas en tiempo regular",
} as const;

export type TiebreakCriterion = keyof typeof TIEBREAK_CRITERIA;

export const DEFAULT_TIEBREAKERS: TiebreakCriterion[] = [
  "PUNTOS",
  "DIFERENCIA_GOLES",
  "GOLES_FAVOR",
  "ENFRENTAMIENTO_DIRECTO",
];

const H2H: TiebreakCriterion[] = ["ENFRENTAMIENTO_DIRECTO", "DIFERENCIA_DIRECTA"];

export interface StandingTeamInput {
  id: string;
  name: string;
}

export interface StandingMatchInput {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  result: ValidatedResult;
}

export interface StandingRow {
  position: number;
  teamId: string;
  teamName: string;
  jj: number;
  jg: number;
  jp: number;
  /** Victorias por desempate (empate ganado). */
  eg: number;
  /** Derrotas por desempate (empate perdido). */
  ep: number;
  /** Empates definitivos (solo si están permitidos). */
  e: number;
  gf: number;
  ge: number;
  dif: number;
  pts: number;
  /** Identificador del grupo empatado que las reglas no pudieron resolver. */
  unresolvedTieGroup: number | null;
}

export interface StandingsResult {
  rows: StandingRow[];
  /** Grupos de equipos (ids) empatados sin resolver con los criterios configurados. */
  unresolvedGroups: string[][];
}

type Stats = Omit<StandingRow, "position" | "unresolvedTieGroup">;

function emptyStats(t: StandingTeamInput): Stats {
  return { teamId: t.id, teamName: t.name, jj: 0, jg: 0, jp: 0, eg: 0, ep: 0, e: 0, gf: 0, ge: 0, dif: 0, pts: 0 };
}

function accumulate(stats: Map<string, Stats>, matches: StandingMatchInput[], rules: ScoringRules) {
  for (const m of matches) {
    for (const teamId of [m.homeTeamId, m.awayTeamId]) {
      const s = stats.get(teamId);
      if (!s) continue; // equipo de otra liga (partido entre ligas): solo cuenta para su propia tabla
      const o = outcomeFor(m.result, teamId, m.homeTeamId, rules);
      s.jj += o.played;
      s.jg += o.won;
      s.jp += o.lost;
      s.eg += o.shootoutWon;
      s.ep += o.shootoutLost;
      s.e += o.drawn;
      s.gf += o.goalsFor;
      s.ge += o.goalsAgainst;
      s.pts += o.points;
    }
  }
  for (const s of stats.values()) s.dif = s.gf - s.ge;
}

export function computeStandings(
  teams: StandingTeamInput[],
  matches: StandingMatchInput[],
  rules: ScoringRules,
  criteria: TiebreakCriterion[] = DEFAULT_TIEBREAKERS,
): StandingsResult {
  const stats = new Map<string, Stats>(teams.map((t) => [t.id, emptyStats(t)]));
  accumulate(stats, matches, rules);
  const crit = criteria.length ? criteria : DEFAULT_TIEBREAKERS;

  const globalKey = (c: TiebreakCriterion, s: Stats): number => {
    switch (c) {
      case "PUNTOS":
        return s.pts;
      case "DIFERENCIA_GOLES":
        return s.dif;
      case "GOLES_FAVOR":
        return s.gf;
      case "MENOS_GOLES_CONTRA":
        return -s.ge;
      case "MAS_VICTORIAS":
        return s.jg;
      case "MENOS_DERROTAS":
        return -s.jp;
      default:
        return 0;
    }
  };

  // Mini tabla con los partidos entre los equipos del grupo.
  const h2hKeys = (c: TiebreakCriterion, group: string[]): Map<string, number> => {
    const set = new Set(group);
    const mini = new Map<string, Stats>(group.map((id) => [id, emptyStats({ id, name: "" })]));
    accumulate(
      mini,
      matches.filter((m) => set.has(m.homeTeamId) && set.has(m.awayTeamId)),
      rules,
    );
    return new Map(group.map((id) => [id, c === "ENFRENTAMIENTO_DIRECTO" ? mini.get(id)!.pts : mini.get(id)!.dif]));
  };

  const rank = (group: string[], ci: number): string[][] => {
    if (group.length <= 1 || ci >= crit.length) return [group];
    const c = crit[ci];
    const keys = H2H.includes(c)
      ? h2hKeys(c, group)
      : new Map(group.map((id) => [id, globalKey(c, stats.get(id)!)]));
    const values = [...new Set(group.map((id) => keys.get(id)!))].sort((a, b) => b - a);
    if (values.length === 1) return rank(group, ci + 1);
    const out: string[][] = [];
    for (const v of values) {
      const part = group.filter((id) => keys.get(id) === v);
      // Un subgrupo más pequeño vuelve a evaluarse desde el inicio: los
      // criterios de enfrentamiento directo se recalculan solo entre ellos.
      out.push(...(part.length === 1 ? [part] : rank(part, 0)));
    }
    return out;
  };

  const byName = (a: string, b: string) =>
    stats.get(a)!.teamName.localeCompare(stats.get(b)!.teamName, "es");
  const buckets = rank(
    teams.map((t) => t.id).sort(byName),
    0,
  );

  const rows: StandingRow[] = [];
  const unresolvedGroups: string[][] = [];
  let pos = 1;
  for (const bucket of buckets) {
    const groupIndex = bucket.length > 1 ? unresolvedGroups.push([...bucket]) - 1 : null;
    for (const id of [...bucket].sort(byName)) {
      rows.push({ position: pos++, ...stats.get(id)!, unresolvedTieGroup: groupIndex });
    }
  }
  return { rows, unresolvedGroups };
}

/**
 * Aplica una decisión oficial sobre el orden de equipos empatados.
 * `order` debe contener exactamente los equipos de un grupo sin resolver.
 */
export function applyManualOrder(result: StandingsResult, groupIndex: number, order: string[]): StandingsResult {
  const group = result.unresolvedGroups[groupIndex];
  if (!group || group.length !== order.length || !group.every((id) => order.includes(id))) {
    throw new Error("El orden manual debe incluir exactamente a los equipos empatados.");
  }
  const rows = [...result.rows];
  const indices = rows.map((r, i) => (group.includes(r.teamId) ? i : -1)).filter((i) => i >= 0);
  const byId = new Map(rows.map((r) => [r.teamId, r]));
  indices.forEach((rowIdx, k) => {
    rows[rowIdx] = { ...byId.get(order[k])!, position: rowIdx + 1, unresolvedTieGroup: null };
  });
  const unresolvedGroups = result.unresolvedGroups.map((g, i) => (i === groupIndex ? [] : g));
  return { rows, unresolvedGroups };
}
