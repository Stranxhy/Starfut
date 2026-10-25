// Generador automático de calendario.
//
// 1. Enfrentamientos: round-robin por liga (método del círculo). Se evalúan
//    varias permutaciones y se elige la que minimiza repeticiones respecto de
//    los partidos ya existentes (útil al regenerar jornadas restantes).
// 2. Horarios y canchas: por cada fecha se resuelve una asignación de costo
//    mínimo (algoritmo húngaro) entre partidos y espacios disponibles. Las
//    restricciones obligatorias tienen costo prohibitivo; las preferencias
//    (repartir horarios, evitar horarios extremos repetidos) costo moderado.

import { isFieldBlocked, teamRestriction, type FieldBlockInput, type TeamRestrictionInput } from "./availability";
import { hungarian } from "./hungarian";
import { generateLeagueRounds, pairKey, roundsPerCycle, seededRandom, type RoundPairings } from "./roundRobin";

export interface SchedulerInput {
  leagues: { id: string; name: string; teams: { id: string; name: string }[] }[];
  /** Jornadas a generar con su fecha (YYYY-MM-DD). */
  rounds: { number: number; date: string }[];
  timeSlots: { id: string; startTime: string }[];
  fields: { id: string; name: string }[];
  fieldBlocks?: FieldBlockInput[];
  teamRestrictions?: TeamRestrictionInput[];
  seed: number;
  /** Enfrentamientos ya existentes (jornadas que se conservan): pairKey → veces. */
  existingPairs?: Record<string, number>;
  /** Intentos de permutación para minimizar repeticiones. */
  attempts?: number;
}

export interface DraftMatch {
  key: string;
  roundNumber: number;
  date: string;
  leagueId: string;
  homeTeamId: string;
  awayTeamId: string;
  timeSlotId: string | null;
  fieldId: string | null;
  /** 0 = primer enfrentamiento entre ambos; n = n-ésima repetición. */
  repeatIndex: number;
  conflicts: string[];
}

export interface DraftRound {
  number: number;
  date: string;
  matches: DraftMatch[];
  byes: { leagueId: string; teamId: string }[];
  availableSlots: number;
  unusedSlots: number;
}

export interface LeagueSummary {
  leagueId: string;
  leagueName: string;
  teams: number;
  uniquePairs: number;
  roundsWithoutRepeats: number;
  repeatsUnavoidable: boolean;
  repeatedMatches: number;
}

export interface ScheduleDraftData {
  rounds: DraftRound[];
  summary: {
    totalMatches: number;
    repeatedMatches: number;
    conflicts: number;
    unscheduledMatches: number;
    leagues: LeagueSummary[];
    /** teamId → timeSlotId → partidos */
    slotDistribution: Record<string, Record<string, number>>;
    seed: number;
  };
  warnings: string[];
  errors: string[];
}

const FORBIDDEN = 1_000_000;
const UNASSIGNED = 10_000_000;

export function generateSchedule(input: SchedulerInput): ScheduleDraftData {
  const warnings: string[] = [];
  const errors: string[] = [];
  const blocks = input.fieldBlocks ?? [];
  const restrictions = input.teamRestrictions ?? [];
  const teamName = new Map<string, string>();
  for (const l of input.leagues) for (const t of l.teams) teamName.set(t.id, t.name);

  const emptyResult = (): ScheduleDraftData => ({
    rounds: [],
    summary: {
      totalMatches: 0,
      repeatedMatches: 0,
      conflicts: 0,
      unscheduledMatches: 0,
      leagues: [],
      slotDistribution: {},
      seed: input.seed,
    },
    warnings,
    errors,
  });

  // ── Validaciones de viabilidad ──
  if (input.rounds.length === 0) errors.push("No hay jornadas por generar.");
  if (input.timeSlots.length === 0) errors.push("No hay horarios activos configurados.");
  if (input.fields.length === 0) errors.push("No hay canchas activas configuradas.");
  const leagues = input.leagues.filter((l) => l.teams.length > 0);
  for (const l of input.leagues) {
    if (l.teams.length === 1) errors.push(`La liga "${l.name}" solo tiene un equipo activo; se requieren al menos dos.`);
  }
  if (leagues.filter((l) => l.teams.length >= 2).length === 0) errors.push("No hay ligas con al menos dos equipos activos.");
  const matchesPerRound = leagues.reduce((s, l) => s + Math.floor(l.teams.length / 2), 0);
  const capacity = input.timeSlots.length * input.fields.length;
  if (matchesPerRound > capacity) {
    errors.push(
      `Cada jornada requiere ${matchesPerRound} partidos, pero solo hay ${capacity} espacios (${input.timeSlots.length} horarios × ${input.fields.length} canchas).`,
    );
  }
  if (errors.length) return emptyResult();


  const rnd = seededRandom(input.seed);
  const roundCount = input.rounds.length;
  const existing = input.existingPairs ?? {};
  const attempts = input.attempts ?? (Object.keys(existing).length ? 300 : 1);

  // ── 1. Enfrentamientos por liga ──
  const leagueRounds = new Map<string, RoundPairings[]>();
  const leagueSummaries: LeagueSummary[] = [];
  for (const l of leagues) {
    const ids = l.teams.map((t) => t.id);
    const perCycle = roundsPerCycle(ids.length);
    let best: RoundPairings[] = [];
    let bestScore = Number.POSITIVE_INFINITY;
    for (let a = 0; a < attempts && ids.length >= 2; a++) {
      const candidate = generateLeagueRounds(ids, Math.max(roundCount, perCycle), rnd);
      // Elegir las jornadas con menos repeticiones respecto de lo existente.
      const scored = candidate.map((r, idx) => ({
        r,
        idx,
        score: r.pairings.reduce((s, p) => s + (existing[pairKey(p.home, p.away)] ?? 0), 0),
      }));
      const chosen =
        Object.keys(existing).length > 0
          ? [...scored].sort((x, y) => x.score - y.score || x.idx - y.idx).slice(0, roundCount).sort((x, y) => x.idx - y.idx)
          : scored.slice(0, roundCount);
      const score = chosen.reduce((s, c) => s + c.score, 0);
      if (score < bestScore) {
        bestScore = score;
        best = chosen.map((c) => c.r);
      }
      if (bestScore === 0) break;
    }
    leagueRounds.set(l.id, best);
    const uniquePairs = (ids.length * (ids.length - 1)) / 2;
    const unavoidable = roundCount > perCycle;
    if (unavoidable && ids.length >= 2) {
      warnings.push(
        `Liga "${l.name}": con ${ids.length} equipos solo existen ${perCycle} jornadas sin repetir rivales; ` +
          `las ${roundCount - perCycle} jornada(s) restantes repetirán enfrentamientos de forma inevitable.`,
      );
    }
    if (ids.length % 2 === 1) {
      warnings.push(`Liga "${l.name}": número impar de equipos (${ids.length}); en cada jornada un equipo descansa.`);
    }
    leagueSummaries.push({
      leagueId: l.id,
      leagueName: l.name,
      teams: ids.length,
      uniquePairs,
      roundsWithoutRepeats: perCycle,
      repeatsUnavoidable: unavoidable,
      repeatedMatches: 0,
    });
  }

  // ── 2. Horarios y canchas por fecha ──
  const slotUsage: Record<string, Record<string, number>> = {};
  const extremeCount: Record<string, number> = {};
  const lastSlot: Record<string, string> = {};
  const fieldUsage: Record<string, Record<string, number>> = {};
  const pairCounts: Record<string, number> = { ...existing };
  const lastTs = input.timeSlots.length - 1;

  const rounds: DraftRound[] = input.rounds.map((round, rIdx) => {
    const date = round.date;
    const matches: DraftMatch[] = [];
    const byes: DraftRound["byes"] = [];
    for (const l of leagues) {
      const rp = leagueRounds.get(l.id)?.[rIdx];
      if (!rp) continue;
      if (rp.bye) byes.push({ leagueId: l.id, teamId: rp.bye });
      for (const p of rp.pairings) {
        const k = pairKey(p.home, p.away);
        const repeatIndex = pairCounts[k] ?? 0;
        pairCounts[k] = repeatIndex + 1;
        matches.push({
          key: `${round.number}-${l.id}-${p.home}-${p.away}`,
          roundNumber: round.number,
          date,
          leagueId: l.id,
          homeTeamId: p.home,
          awayTeamId: p.away,
          timeSlotId: null,
          fieldId: null,
          repeatIndex,
          conflicts: [],
        });
      }
    }

    // Espacios disponibles de la fecha
    const slots: { tsId: string; fieldId: string; ti: number; fi: number }[] = [];
    input.timeSlots.forEach((ts, ti) => {
      input.fields.forEach((f, fi) => {
        if (isFieldBlocked(blocks, f.id, date, ts.id)) return;
        slots.push({ tsId: ts.id, fieldId: f.id, ti, fi });
      });
    });

    if (matches.length > 0) {
      const cost = matches.map((m) => {
        const row = slots.map((s) => {
          let c = 0;
          for (const t of [m.homeTeamId, m.awayTeamId]) {
            if (teamRestriction(restrictions, t, date, s.tsId)) c += FORBIDDEN;
            c += 10 * (slotUsage[t]?.[s.tsId] ?? 0);
            if (s.ti === 0 || s.ti === lastTs) c += 12 * (extremeCount[t] ?? 0);
            if (lastSlot[t] === s.tsId) c += 6;
            c += fieldUsage[t]?.[s.fieldId] ?? 0;
          }
          c += s.fi * 1.5 + s.ti * 0.5;
          return c;
        });
        // Columnas ficticias: permiten dejar un partido sin espacio si no hay alternativa.
        for (let i = 0; i < matches.length; i++) row.push(UNASSIGNED);
        return row;
      });
      const assignment = hungarian(cost);
      matches.forEach((m, i) => {
        const col = assignment[i];
        const slot = col < slots.length ? slots[col] : undefined;
        if (!slot) {
          m.conflicts.push("No hay espacio (horario/cancha) disponible en esta fecha.");
          return;
        }
        const blockedTeam = [m.homeTeamId, m.awayTeamId].find((t) => teamRestriction(restrictions, t, date, slot.tsId));
        if (blockedTeam) {
          m.conflicts.push(
            `${teamName.get(blockedTeam) ?? "Un equipo"} no está disponible el ${date}; el partido queda pendiente de programar.`,
          );
          return;
        }
        m.timeSlotId = slot.tsId;
        m.fieldId = slot.fieldId;
        for (const t of [m.homeTeamId, m.awayTeamId]) {
          slotUsage[t] ??= {};
          slotUsage[t][slot.tsId] = (slotUsage[t][slot.tsId] ?? 0) + 1;
          if (slot.ti === 0 || slot.ti === lastTs) extremeCount[t] = (extremeCount[t] ?? 0) + 1;
          lastSlot[t] = slot.tsId;
          fieldUsage[t] ??= {};
          fieldUsage[t][slot.fieldId] = (fieldUsage[t][slot.fieldId] ?? 0) + 1;
        }
      });
    }

    const used = matches.filter((m) => m.fieldId).length;
    return { number: round.number, date, matches, byes, availableSlots: slots.length, unusedSlots: slots.length - used };
  });

  const all = rounds.flatMap((r) => r.matches);
  for (const s of leagueSummaries) s.repeatedMatches = all.filter((m) => m.leagueId === s.leagueId && m.repeatIndex > 0).length;
  const repeated = all.filter((m) => m.repeatIndex > 0).length;
  if (repeated > 0 && !leagueSummaries.some((s) => s.repeatsUnavoidable)) {
    warnings.push(`${repeated} partido(s) repiten un enfrentamiento ya existente en el calendario conservado.`);
  }

  return {
    rounds,
    summary: {
      totalMatches: all.length,
      repeatedMatches: repeated,
      conflicts: all.filter((m) => m.conflicts.length > 0).length,
      unscheduledMatches: all.filter((m) => !m.timeSlotId).length,
      leagues: leagueSummaries,
      slotDistribution: slotUsage,
      seed: input.seed,
    },
    warnings,
    errors,
  };
}

/** Lista de fechas de juego a partir de una fecha inicial, saltando fechas excluidas. */
export function buildRoundDates(startDate: string, weekday: number, count: number, excluded: string[] = []): string[] {
  const out: string[] = [];
  const d = new Date(`${startDate}T00:00:00.000Z`);
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  const skip = new Set(excluded);
  let guard = 0;
  while (out.length < count && guard++ < 1000) {
    const iso = d.toISOString().slice(0, 10);
    if (!skip.has(iso)) out.push(iso);
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}
