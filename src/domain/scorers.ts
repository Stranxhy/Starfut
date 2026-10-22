// Tabla de goleo: solo goles individuales registrados en partidos válidos.

export const SCORER_CRITERIA = {
  MENOS_PARTIDOS_CON_GOL: "Menos partidos con gol (mayor eficacia)",
  MAS_PARTIDOS_CON_GOL: "Más partidos con gol (mayor regularidad)",
  EQUIPO_MEJOR_CLASIFICADO: "Equipo mejor clasificado en la tabla general",
} as const;

export type ScorerCriterion = keyof typeof SCORER_CRITERIA;

export interface GoalRecord {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  matchId: string;
  goals: number;
}

export interface ScorerRow {
  position: number;
  /** Verdadero si la posición es compartida (empate que los criterios no resuelven). */
  shared: boolean;
  playerId: string;
  playerName: string;
  /** Equipos con los que anotó; si cambió de equipo, se muestran todos con su desglose. */
  teams: { teamId: string; teamName: string; goals: number }[];
  teamLabel: string;
  goals: number;
  matchesWithGoal: number;
}

export function computeScorers(
  records: GoalRecord[],
  criteria: ScorerCriterion[] = [],
  teamPosition: Map<string, number> = new Map(),
): ScorerRow[] {
  const byPlayer = new Map<string, { name: string; goals: number; matches: Set<string>; teams: Map<string, { name: string; goals: number }> }>();
  for (const r of records) {
    if (r.goals <= 0) continue;
    const p = byPlayer.get(r.playerId) ?? { name: r.playerName, goals: 0, matches: new Set(), teams: new Map() };
    p.goals += r.goals;
    p.matches.add(r.matchId);
    const t = p.teams.get(r.teamId) ?? { name: r.teamName, goals: 0 };
    t.goals += r.goals;
    p.teams.set(r.teamId, t);
    byPlayer.set(r.playerId, p);
  }
  const rows = [...byPlayer.entries()].map(([playerId, p]) => {
    const teams = [...p.teams.entries()]
      .map(([teamId, t]) => ({ teamId, teamName: t.name, goals: t.goals }))
      .sort((a, b) => b.goals - a.goals);
    return {
      position: 0,
      shared: false,
      playerId,
      playerName: p.name,
      teams,
      teamLabel: teams.length === 1 ? teams[0].teamName : teams.map((t) => `${t.teamName} (${t.goals})`).join(" / "),
      goals: p.goals,
      matchesWithGoal: p.matches.size,
    };
  });

  const bestTeamPos = (r: ScorerRow) => Math.min(...r.teams.map((t) => teamPosition.get(t.teamId) ?? 9999));
  const keyOf = (r: ScorerRow): number[] => [
    -r.goals,
    ...criteria.map((c) =>
      c === "MENOS_PARTIDOS_CON_GOL" ? r.matchesWithGoal : c === "MAS_PARTIDOS_CON_GOL" ? -r.matchesWithGoal : bestTeamPos(r),
    ),
  ];
  const cmp = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
  };
  rows.sort((a, b) => cmp(keyOf(a), keyOf(b)) || a.playerName.localeCompare(b.playerName, "es"));
  // Clasificación de competencia: 1, 2, 2, 4…
  rows.forEach((r, i) => {
    if (i > 0 && cmp(keyOf(rows[i - 1]), keyOf(r)) === 0) {
      r.position = rows[i - 1].position;
      r.shared = true;
      rows[i - 1].shared = true;
    } else r.position = i + 1;
  });
  return rows;
}

/** Valida que los goles individuales no excedan el marcador del tiempo regular. */
export function validateScorers(
  scorers: { playerId: string; teamId: string; goals: number }[],
  homeTeamId: string,
  awayTeamId: string,
  homeGoals: number,
  awayGoals: number,
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  let home = 0;
  let away = 0;
  for (const s of scorers) {
    if (!Number.isInteger(s.goals) || s.goals <= 0) errors.push("Cada goleador debe tener al menos un gol.");
    if (seen.has(s.playerId)) errors.push("Un jugador aparece más de una vez en la lista de goleadores.");
    seen.add(s.playerId);
    if (s.teamId === homeTeamId) home += s.goals;
    else if (s.teamId === awayTeamId) away += s.goals;
    else errors.push("Un goleador no pertenece a ninguno de los equipos del partido.");
  }
  if (home > homeGoals) errors.push(`Los goles individuales del local (${home}) superan su marcador (${homeGoals}).`);
  if (away > awayGoals) errors.push(`Los goles individuales del visitante (${away}) superan su marcador (${awayGoals}).`);
  return [...new Set(errors)];
}
