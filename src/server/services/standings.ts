import "server-only";
import { prisma, type Tx } from "@/lib/prisma";
import { toISODate } from "@/lib/dates";
import { computeStandings, type StandingRow, type StandingsResult } from "@/domain/standings";
import { computeScorers, type ScorerRow } from "@/domain/scorers";
import type { ValidatedResult } from "@/domain/scoring";
import { zoneForPosition, type Zone } from "@/domain/bracket";
import { getPlayoffFormat, getScoringRules, getTiebreakers } from "./rules";

/** Partidos que alteran la clasificación oficial de la fase regular. */
export const OFFICIAL_STANDING_WHERE = {
  status: "JUGADO" as const,
  countsForStandings: true,
  stage: "REGULAR",
  type: { in: ["OFICIAL", "SUSTITUCION", "INTERLIGA"] as ("OFICIAL" | "SUSTITUCION" | "INTERLIGA")[] },
  result: { isNot: null },
};

export interface StandingsView extends StandingsResult {
  league: { id: string; name: string };
  zones: Zone[];
  rows: (StandingRow & { zone: Zone | null })[];
  /** Jornada más alta con al menos un resultado oficial considerado. */
  throughRound: number | null;
  lastResultDate: string | null;
  frozen: boolean;
  frozenAt: Date | null;
}

export async function getLeagueStandings(
  leagueId: string,
  opts: { upToRound?: number; useSnapshot?: boolean } = {},
  db: Tx = prisma,
): Promise<StandingsView> {
  const league = await db.league.findUniqueOrThrow({ where: { id: leagueId } });

  if (opts.useSnapshot) {
    const snap = await db.standingSnapshot.findUnique({
      where: { leagueId_kind: { leagueId, kind: "CIERRE_FASE_REGULAR" } },
    });
    if (snap) {
      const rows = snap.rows as unknown as StandingRow[];
      const { zones } = await getPlayoffFormat(leagueId, rows.length, db);
      const meta = (await db.match.aggregate({
        where: { leagueId, stage: "REGULAR", status: "JUGADO" },
        _max: { date: true },
      }))._max;
      return {
        league: { id: league.id, name: league.name },
        rows: rows.map((r) => ({ ...r, zone: zoneForPosition(zones, r.position) ?? null })),
        unresolvedGroups: [],
        zones,
        throughRound: null,
        lastResultDate: toISODate(meta.date),
        frozen: true,
        frozenAt: snap.createdAt,
      };
    }
  }

  const teams = await db.team.findMany({
    where: { leagueId },
    select: { id: true, name: true, active: true, homeMatches: { where: OFFICIAL_STANDING_WHERE, select: { id: true }, take: 1 }, awayMatches: { where: OFFICIAL_STANDING_WHERE, select: { id: true }, take: 1 } },
  });
  // Equipos inactivos se conservan en la tabla solo si disputaron partidos oficiales.
  const included = teams.filter((t) => t.active || t.homeMatches.length || t.awayMatches.length);
  const ids = included.map((t) => t.id);

  const matches = await db.match.findMany({
    where: {
      ...OFFICIAL_STANDING_WHERE,
      OR: [{ homeTeamId: { in: ids } }, { awayTeamId: { in: ids } }],
      ...(opts.upToRound ? { round: { number: { lte: opts.upToRound }, phase: "REGULAR" } } : {}),
    },
    include: { result: true, round: { select: { number: true } } },
  });

  const [rules, tb] = await Promise.all([
    getScoringRules(league.seasonId, leagueId, db),
    getTiebreakers(league.seasonId, leagueId, db),
  ]);
  const res = computeStandings(
    included.map((t) => ({ id: t.id, name: t.name })),
    matches.map((m) => ({
      id: m.id,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      result: {
        resultType: m.result!.resultType,
        homeGoals: m.result!.homeGoals,
        awayGoals: m.result!.awayGoals,
        homeShootout: m.result!.homeShootout,
        awayShootout: m.result!.awayShootout,
        winnerTeamId: m.result!.winnerTeamId,
      } satisfies ValidatedResult,
    })),
    rules,
    tb.criteria,
  );
  const { zones } = await getPlayoffFormat(leagueId, res.rows.length, db);
  const rounds = matches.map((m) => m.round?.number ?? 0).filter(Boolean);
  const dates = matches.map((m) => toISODate(m.date)).filter((d): d is string => !!d).sort();
  return {
    league: { id: league.id, name: league.name },
    rows: res.rows.map((r) => ({ ...r, zone: zoneForPosition(zones, r.position) ?? null })),
    unresolvedGroups: res.unresolvedGroups,
    zones,
    throughRound: rounds.length ? Math.max(...rounds) : null,
    lastResultDate: dates.at(-1) ?? null,
    frozen: false,
    frozenAt: null,
  };
}

export interface ScorersView {
  league: { id: string; name: string };
  rows: ScorerRow[];
  throughRound: number | null;
  lastResultDate: string | null;
}

/**
 * Tabla de goleo de una liga. Solo cuenta goles individuales registrados en
 * partidos disputados que no sean amistosos. Incluye la fase eliminatoria si se indica.
 */
export async function getLeagueScorers(
  leagueId: string,
  opts: { includePlayoffs?: boolean; upToRound?: number } = {},
  db: Tx = prisma,
): Promise<ScorersView> {
  const league = await db.league.findUniqueOrThrow({ where: { id: leagueId } });
  const goals = await db.matchScorer.findMany({
    where: {
      team: { leagueId },
      match: {
        status: "JUGADO",
        type: { not: "AMISTOSO" },
        ...(opts.includePlayoffs ? {} : { stage: "REGULAR" }),
        ...(opts.upToRound ? { round: { number: { lte: opts.upToRound }, phase: "REGULAR" } } : {}),
      },
    },
    include: {
      player: { select: { fullName: true } },
      team: { select: { name: true } },
      match: { select: { date: true, round: { select: { number: true, phase: true } } } },
    },
  });
  const [tb, standings] = await Promise.all([
    getTiebreakers(league.seasonId, leagueId, db),
    getLeagueStandings(leagueId, { upToRound: opts.upToRound }, db),
  ]);
  const teamPos = new Map(standings.rows.map((r) => [r.teamId, r.position]));
  const rows = computeScorers(
    goals.map((g) => ({
      playerId: g.playerId,
      playerName: g.player.fullName,
      teamId: g.teamId,
      teamName: g.team.name,
      matchId: g.matchId,
      goals: g.goals,
    })),
    tb.scorerCriteria,
    teamPos,
  );
  const rounds = goals.flatMap((g) => g.match.round?.phase === "REGULAR" ? [g.match.round.number] : []);
  const dates = goals.map((g) => toISODate(g.match.date)).filter((d): d is string => !!d).sort();
  return {
    league: { id: league.id, name: league.name },
    rows,
    throughRound: rounds.length ? Math.max(...rounds) : standings.throughRound,
    lastResultDate: dates.at(-1) ?? standings.lastResultDate,
  };
}
