import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fromISODate, toISODate } from "@/lib/dates";
import { buildRoundDates, generateSchedule, type ScheduleDraftData } from "@/domain/scheduler";
import { pairKey } from "@/domain/roundRobin";
import { ActionError } from "../errors";
import { audit } from "../audit";

export interface DraftParams {
  fromRound: number;
  dates: string[];
  seed: number;
  leagueIds: string[];
}

/** Primera jornada que puede (re)generarse: sin partidos disputados ni calendario confirmado. */
export async function firstEditableRound(seasonId: string): Promise<number> {
  const rounds = await prisma.round.findMany({
    where: { seasonId, phase: "REGULAR" },
    include: { matches: { select: { status: true } } },
    orderBy: { number: "asc" },
  });
  let first = 1;
  for (const r of rounds) {
    if (r.locked || r.matches.some((m) => m.status === "JUGADO")) first = r.number + 1;
  }
  return first;
}

/** Fechas sugeridas para las jornadas a generar (usa las existentes si ya hay jornadas). */
export async function suggestedDates(seasonId: string, fromRound: number): Promise<string[]> {
  const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
  const rounds = await prisma.round.findMany({ where: { seasonId, phase: "REGULAR" }, orderBy: { number: "asc" } });
  const count = season.regularRounds - fromRound + 1;
  if (count <= 0) return [];
  const byNumber = new Map(rounds.map((r) => [r.number, toISODate(r.date)!]));
  const prev = byNumber.get(fromRound - 1);
  let start = toISODate(season.startDate)!;
  if (prev) {
    const d = fromISODate(prev);
    d.setUTCDate(d.getUTCDate() + 1);
    start = toISODate(d)!;
  }
  const computed = buildRoundDates(start, season.weekday, count, season.excludedDates);
  return computed.map((d, i) => byNumber.get(fromRound + i) ?? d);
}

export async function createDraft(seasonId: string, params: DraftParams, userId: string) {
  const season = await prisma.season.findUniqueOrThrow({
    where: { id: seasonId },
    include: {
      timeSlots: { where: { active: true }, orderBy: { startTime: "asc" } },
      venue: { include: { fields: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } } },
      leagues: {
        where: { active: true, id: { in: params.leagueIds } },
        orderBy: { sortOrder: "asc" },
        include: { teams: { where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } } },
      },
    },
  });
  const minRound = await firstEditableRound(seasonId);
  if (params.fromRound < minRound) {
    throw new ActionError(
      `Las jornadas anteriores a la ${minRound} ya están confirmadas o disputadas y no se regeneran automáticamente.`,
    );
  }
  const count = season.regularRounds - params.fromRound + 1;
  if (count <= 0) throw new ActionError("No quedan jornadas por generar en la fase regular.");
  if (params.dates.length !== count) throw new ActionError(`Indica ${count} fechas de juego.`);
  if (new Set(params.dates).size !== params.dates.length) throw new ActionError("Hay fechas repetidas.");
  const dates = params.dates.map((d) => fromISODate(d));
  const [blocks, restrictions, kept] = await Promise.all([
    prisma.fieldBlock.findMany({ where: { date: { in: dates } } }),
    prisma.teamRestriction.findMany({ where: { team: { seasonId } } }),
    prisma.match.findMany({
      where: {
        seasonId,
        stage: "REGULAR",
        type: { in: ["OFICIAL", "SUSTITUCION"] },
        status: { not: "CANCELADO" },
        round: { number: { lt: params.fromRound } },
      },
      select: { homeTeamId: true, awayTeamId: true },
    }),
  ]);
  const existingPairs: Record<string, number> = {};
  for (const m of kept) existingPairs[pairKey(m.homeTeamId, m.awayTeamId)] = (existingPairs[pairKey(m.homeTeamId, m.awayTeamId)] ?? 0) + 1;

  const data = generateSchedule({
    leagues: season.leagues.map((l) => ({ id: l.id, name: l.name, teams: l.teams })),
    rounds: params.dates.map((d, i) => ({ number: params.fromRound + i, date: d })),
    timeSlots: season.timeSlots.map((t) => ({ id: t.id, startTime: t.startTime })),
    fields: season.venue.fields.map((f) => ({ id: f.id, name: f.name })),
    fieldBlocks: blocks.map((b) => ({ fieldId: b.fieldId, date: toISODate(b.date)!, timeSlotId: b.timeSlotId })),
    teamRestrictions: restrictions.map((r) => ({ teamId: r.teamId, date: toISODate(r.date), timeSlotId: r.timeSlotId, reason: r.reason })),
    seed: params.seed,
    existingPairs,
  });
  // Solo un borrador vigente por temporada.
  await prisma.scheduleDraft.updateMany({ where: { seasonId, status: "BORRADOR" }, data: { status: "DESCARTADO" } });
  const draft = await prisma.scheduleDraft.create({
    data: {
      seasonId,
      params: params as unknown as Prisma.InputJsonValue,
      data: data as unknown as Prisma.InputJsonValue,
      createdById: userId,
    },
  });
  return { draft, data };
}

export async function getActiveDraft(seasonId: string) {
  const d = await prisma.scheduleDraft.findFirst({ where: { seasonId, status: "BORRADOR" }, orderBy: { createdAt: "desc" } });
  if (!d) return null;
  return { ...d, params: d.params as unknown as DraftParams, data: d.data as unknown as ScheduleDraftData };
}

export async function discardDraft(draftId: string) {
  await prisma.scheduleDraft.update({ where: { id: draftId }, data: { status: "DESCARTADO" } });
}

/**
 * Confirma el borrador: crea jornadas y partidos en una transacción y protege
 * el calendario. Las jornadas disputadas o confirmadas nunca se sobrescriben.
 */
export async function confirmDraft(draftId: string, opts: { acknowledgeIssues: boolean }, userId: string) {
  const draft = await prisma.scheduleDraft.findUniqueOrThrow({ where: { id: draftId } });
  if (draft.status !== "BORRADOR") throw new ActionError("Este borrador ya no está vigente. Genera uno nuevo.");
  const params = draft.params as unknown as DraftParams;
  const data = draft.data as unknown as ScheduleDraftData;
  if (data.errors.length) throw new ActionError("El borrador tiene errores y no puede confirmarse.");
  const issues: string[] = [];
  if (data.summary.unscheduledMatches) issues.push(`${data.summary.unscheduledMatches} partido(s) sin horario ni cancha (quedarán pendientes).`);
  if (data.summary.repeatedMatches) issues.push(`${data.summary.repeatedMatches} enfrentamiento(s) repetido(s).`);
  if (issues.length && !opts.acknowledgeIssues) {
    throw new ActionError("El calendario tiene situaciones que requieren tu confirmación.", { warnings: issues, needsConfirmation: true });
  }
  const minRound = await firstEditableRound(draft.seasonId);
  if (params.fromRound < minRound) {
    throw new ActionError("El calendario cambió desde que se generó este borrador (hay jornadas confirmadas). Genera uno nuevo.");
  }

  await prisma.$transaction(
    async (tx) => {
      const numbers = data.rounds.map((r) => r.number);
      const existing = await tx.match.findMany({
        where: { seasonId: draft.seasonId, stage: "REGULAR", round: { number: { in: numbers }, phase: "REGULAR" } },
        include: { result: true },
      });
      if (existing.some((m) => m.result || m.locked)) {
        throw new ActionError("Algunas jornadas a reemplazar ya tienen partidos disputados o protegidos.");
      }
      if (existing.length) {
        await tx.match.deleteMany({ where: { id: { in: existing.map((m) => m.id) } } });
      }
      for (const r of data.rounds) {
        const round = await tx.round.upsert({
          where: { seasonId_phase_number: { seasonId: draft.seasonId, phase: "REGULAR", number: r.number } },
          create: { seasonId: draft.seasonId, phase: "REGULAR", number: r.number, date: fromISODate(r.date), locked: true, confirmedAt: new Date() },
          update: { date: fromISODate(r.date), locked: true, confirmedAt: new Date() },
        });
        if (r.matches.length) {
          await tx.match.createMany({
            data: r.matches.map((m) => ({
              seasonId: draft.seasonId,
              leagueId: m.leagueId,
              roundId: round.id,
              stage: "REGULAR",
              type: "OFICIAL" as const,
              countsForStandings: true,
              status: m.timeSlotId && m.fieldId ? ("PROGRAMADO" as const) : ("PENDIENTE" as const),
              date: fromISODate(r.date),
              timeSlotId: m.timeSlotId,
              fieldId: m.fieldId,
              homeTeamId: m.homeTeamId,
              awayTeamId: m.awayTeamId,
              locked: true,
              notes: m.conflicts.length ? m.conflicts.join(" ") : null,
            })),
          });
        }
      }
      await tx.scheduleDraft.update({ where: { id: draftId }, data: { status: "CONFIRMADO" } });
      await tx.season.updateMany({ where: { id: draft.seasonId, status: "CONFIGURACION" }, data: { status: "EN_CURSO" } });
      await audit(tx, {
        userId,
        action: "CALENDARIO_CONFIRMADO",
        entity: "Temporada",
        entityId: draft.seasonId,
        summary: `Calendario confirmado: jornadas ${numbers[0]}–${numbers.at(-1)} (${data.summary.totalMatches} partidos)`,
        after: { semilla: data.summary.seed, partidos: data.summary.totalMatches, reemplazados: existing.length, advertencias: issues },
        reason: issues.length ? "Confirmado con advertencias aceptadas por el administrador" : null,
      });
    },
    { timeout: 60_000 },
  );
}

/** Desbloquea una jornada confirmada (cambio controlado con motivo). */
export async function setRoundLock(roundId: string, locked: boolean, reason: string, userId: string) {
  await prisma.$transaction(async (tx) => {
    const r = await tx.round.update({ where: { id: roundId }, data: { locked } });
    await tx.match.updateMany({ where: { roundId, stage: "REGULAR" }, data: { locked } });
    await audit(tx, {
      userId,
      action: locked ? "CALENDARIO_CONFIRMADO" : "DESBLOQUEAR",
      entity: "Jornada",
      entityId: roundId,
      summary: `Jornada ${r.number} ${locked ? "protegida" : "desbloqueada"}`,
      reason,
    });
  });
}

export async function updateRoundDate(roundId: string, date: string, reason: string, userId: string) {
  await prisma.$transaction(async (tx) => {
    const r = await tx.round.findUniqueOrThrow({ where: { id: roundId }, include: { matches: { include: { result: true } } } });
    if (r.matches.some((m) => m.result)) throw new ActionError("La jornada tiene partidos disputados; cambia la fecha partido por partido.");
    const d = fromISODate(date);
    await tx.round.update({ where: { id: roundId }, data: { date: d } });
    for (const m of r.matches.filter((x) => x.status !== "CANCELADO" && x.date && toISODate(x.date) === toISODate(r.date))) {
      await tx.match.update({
        where: { id: m.id },
        data: { date: d, status: m.status === "PENDIENTE" ? "PENDIENTE" : "REPROGRAMADO", originalDate: m.originalDate ?? m.date, rescheduleCount: { increment: 1 } },
      });
    }
    await audit(tx, {
      userId,
      action: "REPROGRAMAR",
      entity: "Jornada",
      entityId: roundId,
      summary: `Jornada ${r.number}: ${toISODate(r.date)} → ${date}`,
      before: { fecha: toISODate(r.date) },
      after: { fecha: date },
      reason,
    });
  });
}
