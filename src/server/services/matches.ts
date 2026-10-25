import "server-only";
import type { MatchStatus, MatchType, Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/prisma";
import { fromISODate, toISODate } from "@/lib/dates";
import { checkMatchConflicts, type ConflictContext, type MatchCandidate } from "@/domain/conflicts";
import { ActionError } from "../errors";
import { audit } from "../audit";

export const MATCH_INCLUDE = {
  homeTeam: { select: { id: true, name: true, leagueId: true } },
  awayTeam: { select: { id: true, name: true, leagueId: true } },
  league: { select: { id: true, name: true } },
  timeSlot: { select: { id: true, startTime: true } },
  field: { select: { id: true, name: true } },
  round: { select: { id: true, number: true, phase: true, locked: true } },
  result: true,
} satisfies Prisma.MatchInclude;

export type MatchWithRelations = Prisma.MatchGetPayload<{ include: typeof MATCH_INCLUDE }>;

/** Orden estándar: fecha, horario, cancha. */
export function sortMatches<T extends { date: Date | null; timeSlot: { startTime: string } | null; field: { name: string } | null }>(
  list: T[],
): T[] {
  return [...list].sort((a, b) => {
    const da = toISODate(a.date) ?? "9999";
    const dbb = toISODate(b.date) ?? "9999";
    if (da !== dbb) return da < dbb ? -1 : 1;
    const ta = a.timeSlot?.startTime ?? "99:99";
    const tb = b.timeSlot?.startTime ?? "99:99";
    if (ta !== tb) return ta < tb ? -1 : 1;
    return (a.field?.name ?? "").localeCompare(b.field?.name ?? "", "es", { numeric: true });
  });
}

export async function buildConflictContext(
  seasonId: string,
  date: string | null,
  homeTeamId: string,
  awayTeamId: string,
  excludeMatchId: string | undefined,
  db: Tx = prisma,
): Promise<ConflictContext> {
  const season = await db.season.findUniqueOrThrow({
    where: { id: seasonId },
    include: { timeSlots: true, venue: { include: { fields: true } } },
  });
  const d = date ? fromISODate(date) : null;
  const [sameDate, blocks, restrictions, teams, meetings] = await Promise.all([
    d
      ? db.match.findMany({
          where: { seasonId, date: d, status: { not: "CANCELADO" }, ...(excludeMatchId ? { id: { not: excludeMatchId } } : {}) },
          select: { id: true, date: true, timeSlotId: true, fieldId: true, homeTeamId: true, awayTeamId: true },
        })
      : Promise.resolve([]),
    d ? db.fieldBlock.findMany({ where: { date: d } }) : Promise.resolve([]),
    db.teamRestriction.findMany({ where: { teamId: { in: [homeTeamId, awayTeamId] } } }),
    db.team.findMany({ where: { seasonId }, select: { id: true, name: true, leagueId: true, active: true } }),
    db.match.count({
      where: {
        seasonId,
        stage: "REGULAR",
        type: { in: ["OFICIAL", "SUSTITUCION"] },
        status: { not: "CANCELADO" },
        ...(excludeMatchId ? { id: { not: excludeMatchId } } : {}),
        OR: [
          { homeTeamId, awayTeamId },
          { homeTeamId: awayTeamId, awayTeamId: homeTeamId },
        ],
      },
    }),
  ]);
  return {
    sameDateMatches: sameDate.map((m) => ({ ...m, date: toISODate(m.date) })),
    fieldBlocks: blocks.map((b) => ({ fieldId: b.fieldId, date: toISODate(b.date)!, timeSlotId: b.timeSlotId })),
    teamRestrictions: restrictions.map((r) => ({ teamId: r.teamId, date: toISODate(r.date), timeSlotId: r.timeSlotId, reason: r.reason })),
    teams: new Map(teams.map((t) => [t.id, { name: t.name, leagueId: t.leagueId, active: t.active }])),
    fields: new Map(season.venue.fields.map((f) => [f.id, { name: f.name, active: f.active }])),
    timeSlots: new Map(season.timeSlots.map((t) => [t.id, { startTime: t.startTime, active: t.active }])),
    allowInterLeague: season.allowInterLeague,
    previousMeetings: meetings,
  };
}

export interface MatchInput {
  type: MatchType;
  homeTeamId: string;
  awayTeamId: string;
  date: string | null;
  timeSlotId: string | null;
  fieldId: string | null;
  countsForStandings?: boolean;
  notes?: string | null;
  replacesMatchId?: string | null;
}

/**
 * Regla de la liga: todos los partidos de la jornada cuentan para la tabla,
 * incluidos los combinados entre ligas (cada equipo suma en la tabla de su liga).
 * Solo un amistoso declarado como tal y los partidos de eliminatoria no cuentan.
 */
/** Ligas (de los equipos indicados) cuya fase regular ya se cerró. */
export async function closedLeagueIds(teamIds: string[], db: Tx = prisma): Promise<Set<string>> {
  const teams = await db.team.findMany({ where: { id: { in: teamIds } }, select: { leagueId: true } });
  const snaps = await db.standingSnapshot.findMany({
    where: { kind: "CIERRE_FASE_REGULAR", leagueId: { in: teams.map((t) => t.leagueId) } },
    select: { leagueId: true },
  });
  return new Set(snaps.map((x) => x.leagueId));
}

function countsFor(type: MatchType): boolean {
  return type === "OFICIAL" || type === "SUSTITUCION" || type === "INTERLIGA";
}

function derivedStatus(input: Pick<MatchInput, "date" | "timeSlotId" | "fieldId">): MatchStatus {
  return input.date && input.timeSlotId && input.fieldId ? "PROGRAMADO" : "PENDIENTE";
}

async function validateOrThrow(seasonId: string, c: MatchCandidate, confirm: boolean, db: Tx, skipMeetings = false) {
  const ctx = await buildConflictContext(seasonId, c.date, c.homeTeamId, c.awayTeamId, c.id, db);
  if (skipMeetings) ctx.previousMeetings = 0;
  const r = checkMatchConflicts(c, ctx);
  if (r.errors.length) throw new ActionError(r.errors[0], { warnings: [...r.errors.slice(1), ...r.warnings] });
  if (r.warnings.length && !confirm) {
    throw new ActionError("Revisa las advertencias antes de guardar.", { warnings: r.warnings, needsConfirmation: true });
  }
  return r.warnings;
}

async function roundForDate(seasonId: string, date: string | null, db: Tx) {
  if (!date) return null;
  return db.round.findFirst({ where: { seasonId, date: fromISODate(date), phase: "REGULAR" }, select: { id: true } });
}

export async function createMatch(seasonId: string, input: MatchInput, opts: { confirm: boolean; userId: string; reason?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const home = await tx.team.findUniqueOrThrow({ where: { id: input.homeTeamId } });
    if (input.replacesMatchId) {
      const original = await tx.match.findUniqueOrThrow({ where: { id: input.replacesMatchId } });
      if (original.status !== "CANCELADO") throw new ActionError("Solo se puede sustituir un partido cancelado.");
    }
    if (input.type === "ELIMINATORIA") throw new ActionError("Los partidos de eliminatoria se generan desde el módulo Eliminatorias.");
    // Con la fase regular cerrada (clasificación congelada), solo cuentan los partidos de eliminatoria:
    // cualquier otro partido entre equipos de esas ligas se registra como amistoso.
    const closedLeagues = await closedLeagueIds([input.homeTeamId, input.awayTeamId], tx);
    let forcedFriendly = false;
    if (closedLeagues.size && input.type !== "AMISTOSO") {
      input = { ...input, type: "AMISTOSO" };
      forcedFriendly = true;
    }
    const warnings = await validateOrThrow(seasonId, { ...input }, opts.confirm, tx);
    if (forcedFriendly) {
      warnings.unshift("La fase regular ya terminó: el partido se registró como amistoso y no cuenta para la tabla.");
    }
    const round = await roundForDate(seasonId, input.date, tx);
    const match = await tx.match.create({
      data: {
        seasonId,
        leagueId: home.leagueId,
        roundId: round?.id ?? null,
        type: input.type,
        countsForStandings: countsFor(input.type),
        status: derivedStatus(input),
        date: input.date ? fromISODate(input.date) : null,
        timeSlotId: input.timeSlotId,
        fieldId: input.fieldId,
        homeTeamId: input.homeTeamId,
        awayTeamId: input.awayTeamId,
        notes: input.notes || null,
        replacesMatchId: input.replacesMatchId || null,
      },
      include: MATCH_INCLUDE,
    });
    await audit(tx, {
      userId: opts.userId,
      action: "CREAR",
      entity: "Partido",
      entityId: match.id,
      summary: `${match.homeTeam.name} vs ${match.awayTeam.name} (${input.type}${input.replacesMatchId ? ", sustituye partido cancelado" : ""})`,
      after: { ...input, warningsAccepted: warnings },
      reason: opts.reason,
    });
    return { match, warnings };
  });
}

export interface MatchUpdateInput extends Partial<MatchInput> {
  reason?: string | null;
}

export async function updateMatch(
  matchId: string,
  input: MatchUpdateInput,
  opts: { confirm: boolean; userId: string; markRescheduled?: boolean },
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.match.findUniqueOrThrow({ where: { id: matchId }, include: { ...MATCH_INCLUDE, playoffTie: true } });
    const next = {
      type: input.type ?? current.type,
      homeTeamId: input.homeTeamId ?? current.homeTeamId,
      awayTeamId: input.awayTeamId ?? current.awayTeamId,
      date: input.date !== undefined ? input.date : toISODate(current.date),
      timeSlotId: input.timeSlotId !== undefined ? input.timeSlotId : current.timeSlotId,
      fieldId: input.fieldId !== undefined ? input.fieldId : current.fieldId,
    };
    const teamsChanged = next.homeTeamId !== current.homeTeamId || next.awayTeamId !== current.awayTeamId;
    const dateChanged = next.date !== toISODate(current.date);
    const slotChanged = dateChanged || next.timeSlotId !== current.timeSlotId || next.fieldId !== current.fieldId;
    const typeChanged = next.type !== current.type;

    if (current.result && (teamsChanged || typeChanged)) {
      throw new ActionError("El partido tiene un resultado oficial. Revierte el resultado antes de cambiar contrincantes o tipo.");
    }
    if (current.playoffTie && (teamsChanged || typeChanged)) {
      throw new ActionError("Los contrincantes de una eliminatoria los determina el cuadro; no se pueden cambiar aquí.");
    }
    if ((teamsChanged || typeChanged) && next.type !== "AMISTOSO" && current.stage === "REGULAR") {
      const closed = await closedLeagueIds([next.homeTeamId, next.awayTeamId], tx);
      if (closed.size) throw new ActionError("La fase regular ya terminó: este partido solo puede ser amistoso (no cuenta para la tabla).");
    }
    if (current.status === "CANCELADO" && !opts.markRescheduled) {
      throw new ActionError("El partido está cancelado. Usa la opción Reprogramar para reactivarlo.");
    }
    if ((current.locked || current.round?.locked) && !input.reason?.trim()) {
      throw new ActionError(
        "Este partido pertenece a un calendario confirmado y está protegido. Indica el motivo del cambio para continuar.",
        { fieldErrors: { reason: "Motivo obligatorio para modificar un calendario confirmado." } },
      );
    }
    if (current.result && slotChanged && !input.reason?.trim()) {
      throw new ActionError("El partido ya se disputó. Indica el motivo para corregir su fecha u horario.", {
        fieldErrors: { reason: "Motivo obligatorio." },
      });
    }
    const warnings = await validateOrThrow(current.seasonId, { id: matchId, ...next }, opts.confirm, tx, !teamsChanged);

    let status: MatchStatus = current.status;
    if (current.status !== "JUGADO") {
      const base = derivedStatus(next);
      const moved = opts.markRescheduled || (dateChanged && current.date !== null);
      status = base === "PROGRAMADO" && (moved || current.status === "REPROGRAMADO") ? "REPROGRAMADO" : base;
    }
    const home = teamsChanged ? await tx.team.findUniqueOrThrow({ where: { id: next.homeTeamId } }) : null;
    const round = dateChanged && current.stage === "REGULAR" ? await roundForDate(current.seasonId, next.date, tx) : undefined;

    const updated = await tx.match.update({
      where: { id: matchId },
      data: {
        type: next.type,
        countsForStandings:
          input.type !== undefined || input.countsForStandings !== undefined
            ? countsFor(next.type)
            : undefined,
        homeTeamId: next.homeTeamId,
        awayTeamId: next.awayTeamId,
        leagueId: home ? home.leagueId : undefined,
        date: next.date ? fromISODate(next.date) : null,
        timeSlotId: next.timeSlotId,
        fieldId: next.fieldId,
        status,
        notes: input.notes !== undefined ? input.notes || null : undefined,
        roundId: round !== undefined ? (round?.id ?? null) : undefined,
        cancelReason: opts.markRescheduled ? null : undefined,
        ...(dateChanged && current.date
          ? { originalDate: current.originalDate ?? current.date, rescheduleCount: { increment: 1 } }
          : {}),
      },
      include: MATCH_INCLUDE,
    });

    const action = opts.markRescheduled || (dateChanged && current.date) ? "REPROGRAMAR" : teamsChanged ? "CAMBIO_RIVALES" : "PROGRAMAR";
    await audit(tx, {
      userId: opts.userId,
      action,
      entity: "Partido",
      entityId: matchId,
      summary: `${updated.homeTeam.name} vs ${updated.awayTeam.name}`,
      before: snapshot(current),
      after: snapshot(updated),
      reason: input.reason,
    });
    return { match: updated, warnings };
  });
}

function snapshot(m: MatchWithRelations) {
  return {
    tipo: m.type,
    estado: m.status,
    fecha: toISODate(m.date),
    horario: m.timeSlot?.startTime ?? null,
    cancha: m.field?.name ?? null,
    local: m.homeTeam.name,
    visitante: m.awayTeam.name,
  };
}

export async function cancelMatch(matchId: string, reason: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const m = await tx.match.findUniqueOrThrow({ where: { id: matchId }, include: { ...MATCH_INCLUDE, playoffTie: true } });
    if (m.status === "CANCELADO") throw new ActionError("El partido ya está cancelado.");
    if (m.result) throw new ActionError("El partido tiene resultado oficial. Revierte el resultado antes de cancelarlo.");
    if (m.playoffTie) throw new ActionError("Un partido de eliminatoria no se puede cancelar: reprográmalo para que se dispute.");
    const updated = await tx.match.update({
      where: { id: matchId },
      data: { status: "CANCELADO", cancelReason: reason },
      include: MATCH_INCLUDE,
    });
    await audit(tx, {
      userId,
      action: "CANCELAR",
      entity: "Partido",
      entityId: matchId,
      summary: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
      before: snapshot(m),
      after: snapshot(updated),
      reason,
    });
    return updated;
  });
}

/** Espacios libres (horario × cancha) de una fecha. */
export async function freeSlots(seasonId: string, date: string, db: Tx = prisma) {
  const season = await db.season.findUniqueOrThrow({
    where: { id: seasonId },
    include: { timeSlots: { where: { active: true }, orderBy: { startTime: "asc" } }, venue: { include: { fields: { where: { active: true }, orderBy: { sortOrder: "asc" } } } } },
  });
  const d = fromISODate(date);
  const [busy, blocks] = await Promise.all([
    db.match.findMany({ where: { seasonId, date: d, status: { not: "CANCELADO" } }, select: { timeSlotId: true, fieldId: true } }),
    db.fieldBlock.findMany({ where: { date: d } }),
  ]);
  const out: { timeSlotId: string; startTime: string; fieldId: string; fieldName: string }[] = [];
  for (const ts of season.timeSlots) {
    for (const f of season.venue.fields) {
      if (busy.some((b) => b.timeSlotId === ts.id && b.fieldId === f.id)) continue;
      if (blocks.some((b) => b.fieldId === f.id && (b.timeSlotId === null || b.timeSlotId === ts.id))) continue;
      out.push({ timeSlotId: ts.id, startTime: ts.startTime, fieldId: f.id, fieldName: f.name });
    }
  }
  return out;
}

/**
 * Candidatos para sustituir un partido cancelado: equipos que no juegan en ese
 * horario, priorizando a los que no juegan ese día y a los de la misma liga.
 */
export async function substituteCandidates(matchId: string) {
  const m = await prisma.match.findUniqueOrThrow({ where: { id: matchId }, include: MATCH_INCLUDE });
  const season = await prisma.season.findUniqueOrThrow({ where: { id: m.seasonId } });
  const teams = await prisma.team.findMany({
    where: { seasonId: m.seasonId, active: true },
    include: { league: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  const sameDay = m.date
    ? await prisma.match.findMany({
        where: { seasonId: m.seasonId, date: m.date, status: { not: "CANCELADO" } },
        select: { homeTeamId: true, awayTeamId: true, timeSlotId: true },
      })
    : [];
  return teams
    .map((t) => {
      const playing = sameDay.filter((x) => x.homeTeamId === t.id || x.awayTeamId === t.id);
      const simultaneous = playing.some((x) => x.timeSlotId === m.timeSlotId);
      return {
        id: t.id,
        name: t.name,
        leagueId: t.leagueId,
        leagueName: t.league.name,
        sameLeague: t.leagueId === m.leagueId,
        playsThatDay: playing.length > 0,
        simultaneous,
        wasInCancelled: t.id === m.homeTeamId || t.id === m.awayTeamId,
      };
    })
    .filter((t) => !t.simultaneous)
    .sort(
      (a, b) =>
        Number(b.sameLeague) - Number(a.sameLeague) ||
        Number(a.playsThatDay) - Number(b.playsThatDay) ||
        a.name.localeCompare(b.name, "es"),
    )
    .map((t) => ({ ...t, allowedOtherLeague: season.allowInterLeague }));
}

// ───────────── Completar jornada: equipos sin partido en una fecha ─────────────

export async function teamsWithoutMatch(seasonId: string, date: string) {
  const d = fromISODate(date);
  const [teams, matches] = await Promise.all([
    prisma.team.findMany({
      where: { seasonId, active: true, league: { active: true } },
      include: { league: { select: { name: true, sortOrder: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.match.findMany({ where: { seasonId, date: d }, select: { homeTeamId: true, awayTeamId: true, status: true } }),
  ]);
  const playing = new Set(matches.filter((m) => m.status !== "CANCELADO").flatMap((m) => [m.homeTeamId, m.awayTeamId]));
  const cancelled = new Set(matches.filter((m) => m.status === "CANCELADO").flatMap((m) => [m.homeTeamId, m.awayTeamId]));
  return teams
    .filter((t) => !playing.has(t.id))
    .map((t) => ({
      id: t.id,
      name: t.name,
      leagueId: t.leagueId,
      leagueName: t.league.name,
      leagueOrder: t.league.sortOrder,
      reason: cancelled.has(t.id) ? "Partido cancelado" : "Sin partido (descanso)",
    }));
}

export async function proposeDayFill(seasonId: string, date: string) {
  const { proposePairings } = await import("@/domain/pairing");
  const { pairKey } = await import("@/domain/roundRobin");
  const teams = await teamsWithoutMatch(seasonId, date);
  const ids = teams.map((t) => t.id);
  const d = fromISODate(date);
  const [previous, slots, dayMatches] = await Promise.all([
    prisma.match.findMany({
      where: { seasonId, status: { not: "CANCELADO" }, homeTeamId: { in: ids }, awayTeamId: { in: ids } },
      select: { homeTeamId: true, awayTeamId: true },
    }),
    freeSlots(seasonId, date),
    prisma.match.findMany({ where: { seasonId, date: d, status: { not: "CANCELADO" } }, select: { timeSlotId: true } }),
  ]);
  const met = new Map<string, number>();
  for (const m of previous) met.set(pairKey(m.homeTeamId, m.awayTeamId), (met.get(pairKey(m.homeTeamId, m.awayTeamId)) ?? 0) + 1);
  const { pairs, unpaired } = proposePairings(teams, (a, b) => met.get(pairKey(a, b)) ?? 0);

  // Espacios: primero los horarios con menos partidos, luego el más temprano.
  const perSlot = new Map<string, number>();
  for (const m of dayMatches) if (m.timeSlotId) perSlot.set(m.timeSlotId, (perSlot.get(m.timeSlotId) ?? 0) + 1);
  const queue = [...slots].sort(
    (a, b) => (perSlot.get(a.timeSlotId) ?? 0) - (perSlot.get(b.timeSlotId) ?? 0) || a.startTime.localeCompare(b.startTime),
  );
  const byId = new Map(teams.map((t) => [t.id, t]));

  const proposal = pairs.map((p) => {
    const slot = queue.shift() ?? null;
    const home = byId.get(p.home)!;
    const away = byId.get(p.away)!;
    return {
      ...p,
      homeName: home.name,
      awayName: away.name,
      homeLeague: home.leagueName,
      awayLeague: away.leagueName,
      timeSlotId: slot?.timeSlotId ?? null,
      startTime: slot?.startTime ?? null,
      fieldId: slot?.fieldId ?? null,
      fieldName: slot?.fieldName ?? null,
    };
  });
  return { teams, pairs: proposal, unpaired };
}
