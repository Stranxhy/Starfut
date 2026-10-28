import "server-only";
// Carga de datos (desde la base de datos) para cada documento PDF.
// Todas las cifras se obtienen de los servicios oficiales del sistema.
import type { MatchStatus, MatchType, Prisma, ResultType, SanctionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatShort, fromISODate, toISODate, todayISO } from "@/lib/dates";
import { SANCTION_STATUS } from "@/lib/labels";
import { describeSource, type Zone } from "@/domain/bracket";
import type { StandingRow } from "@/domain/standings";
import type { ScorerRow } from "@/domain/scorers";
import { getLeagueScorers, getLeagueStandings, type StandingsView } from "@/server/services/standings";
import { getPlayoffFormat, getScoringRules } from "@/server/services/rules";
import type { ScoringRules } from "@/domain/scoring";
import { MATCH_INCLUDE, sortMatches } from "@/server/services/matches";
import { getBracketView } from "@/server/services/playoffs";
import { PdfParamError, type DocMeta } from "./types";
import { fieldLabel, timeLabel } from "./format";

export type Params = URLSearchParams;

// ───────────────────────────── Parámetros ─────────────────────────────

function optInt(p: Params, key: string, label: string): number | undefined {
  const v = p.get(key);
  if (v == null || v === "") return undefined;
  if (!/^\d{1,3}$/.test(v) || Number(v) < 1) throw new PdfParamError(`El parámetro «${key}» (${label}) debe ser un número entero positivo.`);
  return Number(v);
}

function optDate(p: Params, key: string, label: string): string | undefined {
  const v = p.get(key);
  if (v == null || v === "") return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`)))
    throw new PdfParamError(`El parámetro «${key}» (${label}) debe tener el formato AAAA-MM-DD.`);
  return v;
}

async function findLeague(seasonId: string, p: Params, required: boolean) {
  const id = p.get("league");
  if (!id) {
    if (required) throw new PdfParamError("Falta el parámetro «league» (liga).");
    return null;
  }
  const league = await prisma.league.findFirst({ where: { id, seasonId } });
  if (!league) throw new PdfParamError("La liga indicada no existe en la temporada seleccionada.");
  return league;
}

async function findTeam(seasonId: string, p: Params, required: boolean) {
  const id = p.get("team");
  if (!id) {
    if (required) throw new PdfParamError("Falta el parámetro «team» (equipo).");
    return null;
  }
  const team = await prisma.team.findFirst({ where: { id, seasonId }, include: { league: true } });
  if (!team) throw new PdfParamError("El equipo indicado no existe en la temporada seleccionada.");
  return team;
}

/** Fecha de juego a partir de «date» o de la jornada regular «round». */
async function resolveGameDate(seasonId: string, p: Params): Promise<{ date: string; round: number | null }> {
  const date = optDate(p, "date", "fecha");
  const round = optInt(p, "round", "jornada");
  if (date) return { date, round: null };
  if (!round) throw new PdfParamError("Indica la fecha (date=AAAA-MM-DD) o la jornada (round=N).");
  const r = await prisma.round.findUnique({
    where: { seasonId_phase_number: { seasonId, phase: "REGULAR", number: round } },
  });
  if (!r) throw new PdfParamError(`La jornada ${round} no existe en la temporada seleccionada.`);
  return { date: toISODate(r.date)!, round };
}

const leagueMatchWhere = (leagueId: string | null | undefined): Prisma.MatchWhereInput =>
  leagueId ? { OR: [{ leagueId }, { homeTeam: { leagueId } }, { awayTeam: { leagueId } }] } : {};

// ─────────────────────────── Datos comunes ───────────────────────────

export async function loadMeta(seasonId: string): Promise<DocMeta> {
  const s = await prisma.season.findUnique({ where: { id: seasonId }, include: { tournament: true, venue: true } });
  if (!s) throw new PdfParamError("La temporada indicada no existe.");
  const now = new Date();
  return {
    seasonId: s.id,
    seasonName: s.name,
    isDemo: s.isDemo,
    tournament: s.tournament.name,
    venue: s.venue.name,
    generatedAt: now,
    generatedLabel: formatDateTime(now),
    generatedDate: todayISO(),
  };
}

const MATCH_PDF_INCLUDE = {
  ...MATCH_INCLUDE,
  playoffTie: { select: { stage: { select: { code: true, name: true } } } },
  replacesMatch: { select: { id: true } },
} satisfies Prisma.MatchInclude;
type MatchRow = Prisma.MatchGetPayload<{ include: typeof MATCH_PDF_INCLUDE }>;

export interface MatchLine {
  id: string;
  date: string | null;
  time: string | null;
  field: string | null;
  leagueId: string | null;
  league: string | null;
  round: number | null;
  roundPhase: "REGULAR" | "ELIMINATORIA" | null;
  stage: string;
  stageName: string | null;
  type: MatchType;
  status: MatchStatus;
  homeId: string;
  awayId: string;
  home: string;
  away: string;
  result: {
    home: number;
    away: number;
    type: ResultType;
    homeSO: number | null;
    awaySO: number | null;
    winner: "home" | "away" | null;
  } | null;
  cancelReason: string | null;
  originalDate: string | null;
  rescheduleCount: number;
}

function toLine(m: MatchRow): MatchLine {
  const r = m.result;
  return {
    id: m.id,
    date: toISODate(m.date),
    time: m.timeSlot?.startTime ?? null,
    field: m.field?.name ?? null,
    leagueId: m.league?.id ?? m.homeTeam.leagueId,
    league: m.league?.name ?? null,
    round: m.round?.number ?? null,
    roundPhase: m.round?.phase ?? null,
    stage: m.stage,
    stageName: m.playoffTie?.stage.name ?? null,
    type: m.type,
    status: m.status,
    homeId: m.homeTeam.id,
    awayId: m.awayTeam.id,
    home: m.homeTeam.name,
    away: m.awayTeam.name,
    result: r
      ? {
          home: r.homeGoals,
          away: r.awayGoals,
          type: r.resultType,
          homeSO: r.homeShootout,
          awaySO: r.awayShootout,
          winner: r.winnerTeamId ? (r.winnerTeamId === m.homeTeamId ? "home" : "away") : null,
        }
      : null,
    cancelReason: m.cancelReason,
    originalDate: toISODate(m.originalDate),
    rescheduleCount: m.rescheduleCount,
  };
}

async function findMatches(where: Prisma.MatchWhereInput): Promise<MatchLine[]> {
  const rows = await prisma.match.findMany({ where, include: MATCH_PDF_INCLUDE });
  return sortMatches(rows).map(toLine);
}

async function leagueNames(seasonId: string) {
  const leagues = await prisma.league.findMany({ where: { seasonId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return { list: leagues, byId: new Map(leagues.map((l) => [l.id, l.name])) };
}

/** Subtítulo de una fecha: "JORNADA 13" o el nombre de la etapa eliminatoria. */
function dateCaption(lines: MatchLine[], round: number | null): string | undefined {
  if (round) return `Jornada ${round}`;
  const regular = [...new Set(lines.filter((l) => l.roundPhase === "REGULAR" && l.round).map((l) => l.round!))].sort((a, b) => a - b);
  if (regular.length) return `Jornada ${regular.join(" y ")}`;
  const stages = [...new Set(lines.map((l) => l.stageName).filter(Boolean))];
  return stages.length ? stages.join(" / ") : undefined;
}

export interface MatchGroup {
  title: string;
  lines: MatchLine[];
}

/** Agrupa por liga cuando el documento no se filtró y hay varias ligas. */
function groupByLeague(lines: MatchLine[], names: Map<string, string>, homeLeague: Map<string, string | null>): MatchGroup[] {
  const groups = new Map<string, MatchGroup>();
  for (const l of lines) {
    const a = homeLeague.get(l.homeId) ?? l.leagueId;
    const b = homeLeague.get(l.awayId) ?? l.leagueId;
    const key = a && a === b ? a : "__inter";
    const title = key === "__inter" ? "Entre ligas" : (names.get(key) ?? "Liga");
    if (!groups.has(key)) groups.set(key, { title, lines: [] });
    groups.get(key)!.lines.push(l);
  }
  const order = [...names.keys(), "__inter"];
  return [...groups.entries()].sort((x, y) => order.indexOf(x[0]) - order.indexOf(y[0])).map(([, g]) => g);
}

async function teamLeagues(ids: string[]) {
  const teams = await prisma.team.findMany({ where: { id: { in: ids } }, select: { id: true, leagueId: true } });
  return new Map<string, string | null>(teams.map((t) => [t.id, t.leagueId]));
}

// ─────────────────────────── Tabla general ───────────────────────────

export interface StandingsDocData {
  meta: DocMeta;
  standings: StandingsView;
  round: number | null;
  caption: string;
  updated: string | null;
  showDraws: boolean;
  unresolved: boolean;
  rules: ScoringRules;
}

export async function loadStandings(seasonId: string, p: Params): Promise<StandingsDocData> {
  const meta = await loadMeta(seasonId);
  const league = (await findLeague(seasonId, p, true))!;
  const round = optInt(p, "round", "jornada") ?? null;
  const snapshot = round || p.get("view") === "actual"
    ? null
    : await prisma.standingSnapshot.findUnique({ where: { leagueId_kind: { leagueId: league.id, kind: "CIERRE_FASE_REGULAR" } } });
  const standings = await getLeagueStandings(league.id, snapshot ? { useSnapshot: true } : { upToRound: round ?? undefined });
  const caption = standings.frozen
    ? "Clasificación final"
    : `Jornada ${round ?? standings.throughRound ?? 0}`;
  return {
    meta,
    standings,
    round,
    caption,
    updated: standings.frozenAt ? toISODate(standings.frozenAt) : standings.lastResultDate,
    showDraws: standings.rows.some((r) => r.e > 0),
    unresolved: standings.rows.some((r) => r.unresolvedTieGroup != null),
    rules: await getScoringRules(seasonId, league.id),
  };
}

// ─────────────────────────────── Goleo ───────────────────────────────

export interface ScorersDocData {
  meta: DocMeta;
  league: { id: string; name: string };
  rows: ScorerRow[];
  caption: string;
  updated: string | null;
  includePlayoffs: boolean;
}

export async function loadScorers(seasonId: string, p: Params): Promise<ScorersDocData> {
  const meta = await loadMeta(seasonId);
  const league = (await findLeague(seasonId, p, true))!;
  const round = optInt(p, "round", "jornada");
  const includePlayoffs = p.get("playoffs") === "1";
  const view = await getLeagueScorers(league.id, { upToRound: round, includePlayoffs });
  return {
    meta,
    league: view.league,
    rows: view.rows,
    caption: `Jornada ${round ?? view.throughRound ?? 0}`,
    updated: view.lastResultDate,
    includePlayoffs,
  };
}

// ───────────────────────── Resultados y rol ─────────────────────────

export interface DayDocData {
  meta: DocMeta;
  date: string;
  caption?: string;
  leagueName: string;
  filteredLeague: boolean;
  groups: MatchGroup[];
  cancelled: MatchLine[];
  total: number;
  showLeagueColumn: boolean;
  /** Liga de cada equipo (columna LIGA cuando el documento abarca varias ligas). */
  teamLeague: Record<string, string>;
}

async function loadDay(seasonId: string, p: Params, mode: "resultados" | "rol"): Promise<DayDocData> {
  const meta = await loadMeta(seasonId);
  const league = await findLeague(seasonId, p, false);
  const { date, round } = await resolveGameDate(seasonId, p);
  const all = await findMatches({ seasonId, date: fromISODate(date), ...leagueMatchWhere(league?.id) });
  const lines = mode === "rol" ? all.filter((m) => m.status !== "CANCELADO") : all;
  const cancelled = mode === "rol" ? all.filter((m) => m.status === "CANCELADO") : [];
  const names = await leagueNames(seasonId);
  const tl = await teamLeagues([...new Set(all.flatMap((m) => [m.homeId, m.awayId]))]);
  const leaguesPresent = new Set(lines.flatMap((m) => [tl.get(m.homeId), tl.get(m.awayId)]).filter(Boolean));
  const multi = !league && leaguesPresent.size > 1;
  const single = !league && leaguesPresent.size === 1 ? names.byId.get([...leaguesPresent][0]!) : undefined;
  return {
    meta,
    date,
    caption: dateCaption(all, round),
    leagueName: league?.name ?? single ?? "Todas las ligas",
    filteredLeague: !!league,
    groups: mode === "resultados" && multi ? groupByLeague(lines, names.byId, tl) : [{ title: "", lines }],
    cancelled,
    total: lines.length,
    showLeagueColumn: mode === "rol" && multi,
    teamLeague: Object.fromEntries(
      [...tl.entries()].map(([teamId, leagueId]) => [teamId, (leagueId && names.byId.get(leagueId)) || ""]),
    ),
  };
}

export const loadResults = (seasonId: string, p: Params) => loadDay(seasonId, p, "resultados");
export const loadRol = (seasonId: string, p: Params) => loadDay(seasonId, p, "rol");

/** Nombre de liga de un equipo (para la columna LIGA del rol). */
export async function teamLeagueNames(seasonId: string): Promise<Map<string, string>> {
  const teams = await prisma.team.findMany({ where: { seasonId }, select: { id: true, league: { select: { name: true } } } });
  return new Map(teams.map((t) => [t.id, t.league.name]));
}

// ───────────────────────────── Calendario ─────────────────────────────

export interface CalendarRound {
  title: string;
  dates: { date: string | null; lines: MatchLine[] }[];
}

export interface CalendarDocData {
  meta: DocMeta;
  leagueName: string;
  filteredLeague: boolean;
  rounds: CalendarRound[];
  total: number;
  showLeagueColumn: boolean;
  teamLeague: Record<string, string>;
}

function splitByDate(lines: MatchLine[]) {
  const out: { date: string | null; lines: MatchLine[] }[] = [];
  for (const l of lines) {
    const last = out.at(-1);
    if (last && last.date === l.date) last.lines.push(l);
    else out.push({ date: l.date, lines: [l] });
  }
  return out;
}

export async function loadCalendar(seasonId: string, p: Params): Promise<CalendarDocData> {
  const meta = await loadMeta(seasonId);
  const league = await findLeague(seasonId, p, false);
  const lines = await findMatches({ seasonId, ...leagueMatchWhere(league?.id) });
  const groups = new Map<string, { sort: number; title: string; lines: MatchLine[] }>();
  for (const l of lines) {
    let key: string;
    let sort: number;
    let title: string;
    if (l.round && l.roundPhase === "REGULAR") {
      key = `R${l.round}`;
      sort = l.round;
      title = `Jornada ${l.round}`;
    } else if (l.round && l.roundPhase === "ELIMINATORIA") {
      key = `E${l.round}`;
      sort = 1000 + l.round;
      title = l.stageName ?? "Eliminatoria";
    } else {
      key = "X";
      sort = 5000;
      title = "Otros partidos";
    }
    if (!groups.has(key)) groups.set(key, { sort, title, lines: [] });
    groups.get(key)!.lines.push(l);
  }
  const teamLeague = await teamLeagueNames(seasonId);
  const leaguesPresent = new Set(lines.flatMap((l) => [teamLeague.get(l.homeId), teamLeague.get(l.awayId)]));
  return {
    meta,
    leagueName: league?.name ?? (leaguesPresent.size === 1 ? [...leaguesPresent][0]! : "Todas las ligas"),
    filteredLeague: !!league,
    rounds: [...groups.values()].sort((a, b) => a.sort - b.sort).map((g) => ({ title: g.title, dates: splitByDate(g.lines) })),
    total: lines.length,
    showLeagueColumn: !league && leaguesPresent.size > 1,
    teamLeague: Object.fromEntries(teamLeague),
  };
}

// ─────────────────────── Historial de resultados ───────────────────────

export interface HistoryDocData {
  meta: DocMeta;
  leagueName: string;
  teamName: string | null;
  days: { date: string | null; caption?: string; lines: MatchLine[] }[];
  total: number;
}

export async function loadHistory(seasonId: string, p: Params): Promise<HistoryDocData> {
  const meta = await loadMeta(seasonId);
  const league = await findLeague(seasonId, p, false);
  const team = await findTeam(seasonId, p, false);
  if (league && team && team.leagueId !== league.id) {
    throw new PdfParamError("El equipo indicado no pertenece a la liga seleccionada.");
  }
  const lines = await findMatches({
    seasonId,
    status: "JUGADO",
    result: { isNot: null },
    ...leagueMatchWhere(league?.id),
    ...(team ? { AND: [{ OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] }] } : {}),
  });
  return {
    meta,
    leagueName: league?.name ?? team?.league.name ?? "Todas las ligas",
    teamName: team?.name ?? null,
    days: splitByDate(lines).map((d) => ({ ...d, caption: dateCaption(d.lines, null) })),
    total: lines.length,
  };
}

// ─────────────────── Cancelaciones y reprogramaciones ───────────────────

export interface CancellationsDocData {
  meta: DocMeta;
  leagueName: string;
  cancelled: (MatchLine & { replacements: MatchLine[] })[];
  rescheduled: (MatchLine & { previousDate: string | null })[];
}

export async function loadCancellations(seasonId: string, p: Params): Promise<CancellationsDocData> {
  const meta = await loadMeta(seasonId);
  const league = await findLeague(seasonId, p, false);
  const cancelled = await findMatches({ seasonId, status: "CANCELADO", ...leagueMatchWhere(league?.id) });
  const replacementRows = cancelled.length
    ? await prisma.match.findMany({ where: { replacesMatchId: { in: cancelled.map((c) => c.id) } }, include: MATCH_PDF_INCLUDE })
    : [];
  const rescheduled = await prisma.match.findMany({
    where: {
      seasonId,
      ...leagueMatchWhere(league?.id),
      AND: [{ OR: [{ rescheduleCount: { gt: 0 } }, { originalDate: { not: null } }, { status: "REPROGRAMADO" }] }],
    },
    include: { ...MATCH_PDF_INCLUDE, round: { select: { id: true, number: true, phase: true, locked: true, date: true } } },
  });
  return {
    meta,
    leagueName: league?.name ?? "Todas las ligas",
    cancelled: cancelled.map((c) => ({
      ...c,
      replacements: sortMatches(replacementRows.filter((r) => r.replacesMatchId === c.id)).map(toLine),
    })),
    rescheduled: sortMatches(rescheduled).map((m) => {
      const roundDate = toISODate(m.round?.date);
      const date = toISODate(m.date);
      return {
        ...toLine(m),
        previousDate: toISODate(m.originalDate) ?? (roundDate && roundDate !== date ? roundDate : null),
      };
    }),
  };
}

// ───────────────────────────── Sanciones ─────────────────────────────

export interface SanctionLine {
  id: string;
  player: string;
  team: string;
  league: string;
  type: string;
  reason: string;
  duration: number;
  unit: string;
  unitKind: string;
  status: SanctionStatus;
  date: string;
  served: number;
}

export interface SanctionsDocData {
  meta: DocMeta;
  rows: SanctionLine[];
  filters: string[];
}

const SANCTION_STATUSES = Object.keys(SANCTION_STATUS) as SanctionStatus[];

export async function loadSanctions(seasonId: string, p: Params): Promise<SanctionsDocData> {
  const meta = await loadMeta(seasonId);
  const league = await findLeague(seasonId, p, false);
  const team = await findTeam(seasonId, p, false);
  const filters: string[] = [];
  const where: Prisma.SanctionWhereInput = { seasonId };
  if (league) {
    where.team = { leagueId: league.id };
    filters.push(`Liga: ${league.name}`);
  }
  if (team) {
    where.teamId = team.id;
    filters.push(`Equipo: ${team.name}`);
  }
  const playerId = p.get("player");
  if (playerId) {
    const player = await prisma.player.findFirst({ where: { id: playerId, seasonId } });
    if (!player) throw new PdfParamError("El jugador indicado no existe en la temporada seleccionada.");
    where.playerId = player.id;
    filters.push(`Jugador: ${player.fullName}`);
  }
  const status = p.get("status");
  if (status) {
    if (!SANCTION_STATUSES.includes(status as SanctionStatus))
      throw new PdfParamError(`Estado de sanción inválido. Usa uno de: ${SANCTION_STATUSES.join(", ")}.`);
    where.status = status as SanctionStatus;
    filters.push(`Estado: ${SANCTION_STATUS[status].label}`);
  }
  const typeId = p.get("type");
  if (typeId) {
    const type = await prisma.sanctionType.findUnique({ where: { id: typeId } });
    if (!type) throw new PdfParamError("El tipo de sanción indicado no existe.");
    where.typeId = type.id;
    filters.push(`Tipo: ${type.name}`);
  }
  const from = optDate(p, "from", "desde");
  const to = optDate(p, "to", "hasta");
  if (from && to && from > to) throw new PdfParamError("La fecha «desde» no puede ser posterior a la fecha «hasta».");
  if (from || to) {
    where.date = { ...(from ? { gte: fromISODate(from) } : {}), ...(to ? { lte: fromISODate(to) } : {}) };
    filters.push(`Periodo: ${from ? formatShort(from) : "inicio"} a ${to ? formatShort(to) : "hoy"}`);
  }
  const rows = await prisma.sanction.findMany({
    where,
    include: {
      player: { select: { fullName: true } },
      team: { select: { name: true, league: { select: { name: true } } } },
      type: { select: { name: true } },
      unit: { select: { name: true, kind: true } },
      _count: { select: { servings: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return {
    meta,
    filters,
    rows: rows.map((s) => ({
      id: s.id,
      player: s.player.fullName,
      team: s.team.name,
      league: s.team.league.name,
      type: s.type.name,
      reason: s.reason,
      duration: s.duration,
      unit: s.unit.name,
      unitKind: s.unit.kind,
      status: s.status,
      date: toISODate(s.date)!,
      served: s._count.servings,
    })),
  };
}

// ─────────────────────────── Eliminatorias ───────────────────────────

export interface BracketSide {
  /** Nombre del equipo o "Por definir". */
  label: string;
  known: boolean;
  /** Descripción del origen: "5.º lugar", "Ganador Repechaje 1". */
  source: string;
  /** Código del origen: S5, W:REPECHAJE:1… */
  sourceCode: string;
  seed: number | null;
  goals: number | null;
  pens: number | null;
  winner: boolean;
}

export interface BracketTieView {
  slot: number;
  home: BracketSide;
  away: BracketSide;
  /** Fecha, hora y campo del partido. */
  info: string | null;
  status: string | null;
}

export interface BracketDocData {
  meta: DocMeta;
  leagueName: string;
  stages: { code: string; name: string; ties: BracketTieView[] }[];
  champion: string | null;
  generated: boolean;
  officialConfirmed: boolean;
  frozenAt: string | null;
}

export async function loadBracket(seasonId: string, p: Params): Promise<BracketDocData> {
  const meta = await loadMeta(seasonId);
  const league = (await findLeague(seasonId, p, true))!;
  const view = await getBracketView(league.id);
  const teamCount = await prisma.team.count({ where: { leagueId: league.id, active: true } });
  const format = await getPlayoffFormat(league.id, teamCount);

  if (!view.stages.length) {
    const names = Object.fromEntries(format.bracket.stages.map((s) => [s.code, s.name]));
    const pending = (src: string): BracketSide => ({
      label: "Por definir",
      known: false,
      source: describeSource(src, names),
      sourceCode: src.toUpperCase(),
      seed: null,
      goals: null,
      pens: null,
      winner: false,
    });
    return {
      meta,
      leagueName: league.name,
      stages: format.bracket.stages.map((s) => ({
        code: s.code,
        name: s.name,
        ties: s.ties.map((t, i) => ({ slot: i + 1, home: pending(t.home), away: pending(t.away), info: null, status: null })),
      })),
      champion: null,
      generated: false,
      officialConfirmed: format.officialConfirmed,
      frozenAt: null,
    };
  }

  return {
    meta,
    leagueName: league.name,
    stages: view.stages.map((s) => ({
      code: s.code,
      name: s.name,
      ties: s.ties.map((t) => {
        const m = t.match;
        const res = m?.result ?? null;
        const side = (team: { id: string; name: string } | null, src: string, isHome: boolean): BracketSide => ({
          label: team?.name ?? "Por definir",
          known: !!team,
          source: describeSource(src, view.stageNames),
          sourceCode: src.toUpperCase(),
          seed: team ? (view.seedOf.get(team.id) ?? null) : null,
          goals: res ? (isHome ? res.homeGoals : res.awayGoals) : null,
          pens: res ? ((isHome ? res.homeShootout : res.awayShootout) ?? null) : null,
          winner: !!team && t.winnerTeamId === team.id,
        });
        const info = m
          ? [m.date ? formatShort(m.date) : null, m.timeSlot ? timeLabel(m.timeSlot.startTime) : null, m.field ? `Campo ${fieldLabel(m.field.name)}` : null]
              .filter(Boolean)
              .join(" · ") || null
          : null;
        return {
          slot: t.slot,
          home: side(t.homeTeam, t.homeSource, true),
          away: side(t.awayTeam, t.awaySource, false),
          info,
          status: m?.status ?? null,
        };
      }),
    })),
    champion: view.league.championTeam?.name ?? null,
    generated: true,
    officialConfirmed: format.officialConfirmed,
    frozenAt: view.snapshot ? toISODate(view.snapshot.createdAt) : null,
  };
}

// ───────────────────────────── Equipos ─────────────────────────────

export interface TeamsDocData {
  meta: DocMeta;
  leagueName: string;
  filteredLeague: boolean;
  rows: { id: string; name: string; league: string; active: boolean; players: number }[];
}

export async function loadTeams(seasonId: string, p: Params): Promise<TeamsDocData> {
  const meta = await loadMeta(seasonId);
  const league = await findLeague(seasonId, p, false);
  const teams = await prisma.team.findMany({
    where: { seasonId, ...(league ? { leagueId: league.id } : {}) },
    select: {
      id: true,
      name: true,
      active: true,
      league: { select: { name: true, sortOrder: true } },
      _count: { select: { players: { where: { active: true } } } },
    },
  });
  teams.sort(
    (a, b) =>
      a.league.sortOrder - b.league.sortOrder ||
      a.league.name.localeCompare(b.league.name, "es") ||
      Number(b.active) - Number(a.active) ||
      a.name.localeCompare(b.name, "es"),
  );
  return {
    meta,
    leagueName: league?.name ?? "Todas las ligas",
    filteredLeague: !!league,
    rows: teams.map((t) => ({ id: t.id, name: t.name, league: t.league.name, active: t.active, players: t._count.players })),
  };
}

// ───────────────────── Estadísticas de un equipo ─────────────────────

export interface TeamStatsDocData {
  meta: DocMeta;
  team: { id: string; name: string; league: string; active: boolean };
  standing: (StandingRow & { zone: Zone | null }) | null;
  teamsInLeague: number;
  throughRound: number | null;
  showDraws: boolean;
  results: (MatchLine & { outcome: string; rival: string; venueSide: "L" | "V" })[];
  scorers: { position: number; name: string; goals: number }[];
  sanctions: { total: number; byStatus: { label: string; count: number }[] };
  upcoming: (MatchLine & { rival: string; venueSide: "L" | "V" })[];
}

function outcomeFor(m: MatchLine, teamId: string): string {
  const r = m.result;
  if (!r) return "—";
  const mine = m.homeId === teamId ? "home" : "away";
  if (r.type === "DESEMPATE") return r.winner === mine ? "EG" : "EP";
  if (r.type === "EMPATE") return "E";
  if (r.winner) return r.winner === mine ? "G" : "P";
  const gf = mine === "home" ? r.home : r.away;
  const ge = mine === "home" ? r.away : r.home;
  return gf > ge ? "G" : gf < ge ? "P" : "E";
}

export async function loadTeamStats(seasonId: string, p: Params): Promise<TeamStatsDocData> {
  const meta = await loadMeta(seasonId);
  const team = (await findTeam(seasonId, p, true))!;
  const [standings, scorers, sanctions, matches] = await Promise.all([
    getLeagueStandings(team.leagueId),
    getLeagueScorers(team.leagueId),
    prisma.sanction.groupBy({ by: ["status"], where: { seasonId, teamId: team.id }, _count: true }),
    findMatches({ seasonId, OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] }),
  ]);
  const rivalOf = (m: MatchLine) => (m.homeId === team.id ? m.away : m.home);
  const sideOf = (m: MatchLine): "L" | "V" => (m.homeId === team.id ? "L" : "V");
  const teamScorers = scorers.rows
    .map((r) => ({ position: r.position, name: r.playerName, goals: r.teams.find((t) => t.teamId === team.id)?.goals ?? 0 }))
    .filter((r) => r.goals > 0)
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, "es"));
  let pos = 0;
  let prev = -1;
  const ranked = teamScorers.map((s, i) => {
    if (s.goals !== prev) pos = i + 1;
    prev = s.goals;
    return { ...s, position: pos };
  });
  return {
    meta,
    team: { id: team.id, name: team.name, league: team.league.name, active: team.active },
    standing: standings.rows.find((r) => r.teamId === team.id) ?? null,
    teamsInLeague: standings.rows.length,
    throughRound: standings.throughRound,
    showDraws: standings.rows.some((r) => r.e > 0),
    results: matches
      .filter((m) => m.status === "JUGADO" && m.result)
      .map((m) => ({ ...m, outcome: outcomeFor(m, team.id), rival: rivalOf(m), venueSide: sideOf(m) })),
    scorers: ranked,
    sanctions: {
      total: sanctions.reduce((a, s) => a + s._count, 0),
      byStatus: sanctions.map((s) => ({ label: SANCTION_STATUS[s.status]?.label ?? s.status, count: s._count })),
    },
    upcoming: matches
      .filter((m) => m.status !== "JUGADO" && m.status !== "CANCELADO")
      .map((m) => ({ ...m, rival: rivalOf(m), venueSide: sideOf(m) })),
  };
}

