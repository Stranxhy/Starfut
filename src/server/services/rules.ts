import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/prisma";
import { DEFAULT_SCORING, type ScoringRules } from "@/domain/scoring";
import { DEFAULT_TIEBREAKERS, TIEBREAK_CRITERIA, type TiebreakCriterion } from "@/domain/standings";
import { SCORER_CRITERIA, type ScorerCriterion } from "@/domain/scorers";
import { DEFAULT_BRACKET, defaultZones, type BracketFormat, type Zone } from "@/domain/bracket";

/** Reglas de puntuación efectivas: las de la liga si existen; si no, las de la temporada. */
export async function getScoringRules(seasonId: string, leagueId?: string | null, db: Tx = prisma): Promise<ScoringRules> {
  const configs = await db.scoringConfig.findMany({
    where: { seasonId, OR: [{ leagueId: null }, ...(leagueId ? [{ leagueId }] : [])] },
  });
  const c = configs.find((x) => x.leagueId === leagueId) ?? configs.find((x) => x.leagueId === null);
  if (!c) return DEFAULT_SCORING;
  return {
    winPoints: c.winPoints,
    lossPoints: c.lossPoints,
    shootoutWinPoints: c.shootoutWinPoints,
    shootoutLossPoints: c.shootoutLossPoints,
    allowDraws: c.allowDraws,
    drawPoints: c.drawPoints,
    shootoutKicks: c.shootoutKicks,
  };
}

export async function getTiebreakers(
  seasonId: string,
  leagueId?: string | null,
  db: Tx = prisma,
): Promise<{ criteria: TiebreakCriterion[]; scorerCriteria: ScorerCriterion[] }> {
  const configs = await db.tiebreakConfig.findMany({
    where: { seasonId, OR: [{ leagueId: null }, ...(leagueId ? [{ leagueId }] : [])] },
  });
  const c = configs.find((x) => x.leagueId === leagueId) ?? configs.find((x) => x.leagueId === null);
  const criteria = (c?.criteria ?? []).filter((k): k is TiebreakCriterion => k in TIEBREAK_CRITERIA);
  const scorerCriteria = (c?.scorerCriteria ?? []).filter((k): k is ScorerCriterion => k in SCORER_CRITERIA);
  return { criteria: criteria.length ? criteria : DEFAULT_TIEBREAKERS, scorerCriteria };
}

export function parseBracket(json: Prisma.JsonValue | null | undefined): BracketFormat {
  const v = json as unknown as BracketFormat | null;
  if (v && Array.isArray(v.stages)) return v;
  return DEFAULT_BRACKET;
}

export function parseZones(json: Prisma.JsonValue | null | undefined): Zone[] | null {
  const v = json as unknown as Zone[] | null;
  return Array.isArray(v) ? v : null;
}

/** Formato de eliminatoria y zonas de color de una liga (adaptadas al número de equipos). */
export async function getPlayoffFormat(leagueId: string, teamCount: number, db: Tx = prisma) {
  const f = await db.playoffFormat.findUnique({ where: { leagueId } });
  const bracket = parseBracket(f?.stages);
  const stored = parseZones(f?.zones);
  const zones = (stored && stored.length ? stored : defaultZones(bracket, teamCount))
    .map((z) => ({ ...z, positions: z.positions.filter((p) => p <= teamCount) }))
    .filter((z) => z.positions.length > 0);
  return { bracket, zones, officialConfirmed: f?.officialConfirmed ?? false, customZones: !!stored?.length };
}
