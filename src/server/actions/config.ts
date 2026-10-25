"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fromISODate, toISODate } from "@/lib/dates";
import { validateBracket, type BracketFormat, type Zone } from "@/domain/bracket";
import { TIEBREAK_CRITERIA } from "@/domain/standings";
import { SCORER_CRITERIA } from "@/domain/scorers";
import { cleanName, normalizeName } from "@/domain/text";
import { ActionError, runAction, type ActionResult } from "../action";
import { audit } from "../audit";
import { getSeasonId } from "../season";
import { isConfirm, parseForm, zs } from "../validation";

async function seasonId() {
  const id = await getSeasonId();
  if (!id) throw new ActionError("No hay temporada seleccionada.");
  return id;
}

// ───────────────────────── General ─────────────────────────

export async function updateGeneralAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const sid = await seasonId();
    const d = parseForm(
      z.object({
        tournamentName: zs.text(80, "El nombre del torneo"),
        modality: zs.text(40, "La modalidad"),
        venueName: zs.text(80, "El nombre de la sede"),
        seasonName: zs.text(80, "El nombre de la temporada"),
        startDate: zs.date,
        weekday: zs.int(0, 6),
        regularRounds: zs.int(1, 60, "El número de jornadas"),
        allowInterLeague: zs.bool,
        excludedDates: z.string().optional(),
      }),
      fd,
    );
    const excluded = (d.excludedDates ?? "")
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const x of excluded) if (!/^\d{4}-\d{2}-\d{2}$/.test(x)) throw new ActionError(`Fecha excluida inválida: "${x}" (usa AAAA-MM-DD).`);
    const season = await prisma.season.findUniqueOrThrow({ where: { id: sid }, include: { tournament: true, venue: true } });
    const maxRound = await prisma.round.aggregate({ where: { seasonId: sid, phase: "REGULAR" }, _max: { number: true } });
    if ((maxRound._max.number ?? 0) > d.regularRounds && !isConfirm(fd)) {
      throw new ActionError("Hay jornadas registradas por encima del nuevo número de jornadas.", {
        warnings: [`El calendario tiene ${maxRound._max.number} jornadas. Las jornadas excedentes no se eliminan automáticamente.`],
        needsConfirmation: true,
      });
    }
    await prisma.$transaction(async (tx) => {
      await tx.tournament.update({ where: { id: season.tournamentId }, data: { name: cleanName(d.tournamentName), modality: cleanName(d.modality) } });
      await tx.venue.update({ where: { id: season.venueId }, data: { name: cleanName(d.venueName) } });
      await tx.season.update({
        where: { id: sid },
        data: {
          name: cleanName(d.seasonName),
          startDate: fromISODate(d.startDate),
          weekday: d.weekday,
          regularRounds: d.regularRounds,
          allowInterLeague: d.allowInterLeague,
          excludedDates: [...new Set(excluded)].sort(),
        },
      });
      await audit(tx, {
        userId: user.id, action: "CONFIGURACION", entity: "Temporada", entityId: sid, summary: "Configuración general",
        before: { torneo: season.tournament.name, sede: season.venue.name, temporada: season.name, inicio: toISODate(season.startDate), dia: season.weekday, jornadas: season.regularRounds, entreLigas: season.allowInterLeague },
        after: { torneo: d.tournamentName, sede: d.venueName, temporada: d.seasonName, inicio: d.startDate, dia: d.weekday, jornadas: d.regularRounds, entreLigas: d.allowInterLeague },
      });
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Configuración guardada." };
  });
}

// ───────────────────────── Horarios y canchas ─────────────────────────

export async function saveTimeSlotAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const sid = await seasonId();
    const d = parseForm(z.object({ id: zs.optId, startTime: zs.time, durationMinutes: zs.int(10, 240, "La duración") }), fd);
    const dup = await prisma.timeSlot.findFirst({ where: { seasonId: sid, startTime: d.startTime, ...(d.id ? { id: { not: d.id } } : {}) } });
    if (dup) throw new ActionError("Ya existe ese horario.", { fieldErrors: { startTime: "Duplicado" } });
    await prisma.$transaction(async (tx) => {
      const t = d.id
        ? await tx.timeSlot.update({ where: { id: d.id }, data: { startTime: d.startTime, durationMinutes: d.durationMinutes } })
        : await tx.timeSlot.create({ data: { seasonId: sid, startTime: d.startTime, durationMinutes: d.durationMinutes } });
      await audit(tx, { userId: user.id, action: "CONFIGURACION", entity: "Horario", entityId: t.id, summary: `Horario ${t.startTime}`, after: d });
    });
    revalidatePath("/configuracion/horarios-canchas");
    return { ok: true, message: "Horario guardado." };
  });
}

export async function toggleTimeSlotAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    const t = await prisma.timeSlot.findUniqueOrThrow({ where: { id } });
    if (t.active) {
      const future = await prisma.match.count({ where: { timeSlotId: id, status: { in: ["PROGRAMADO", "REPROGRAMADO"] }, date: { gte: new Date() } } });
      if (future && !isConfirm(fd)) {
        throw new ActionError("Horario con partidos programados", { warnings: [`Hay ${future} partido(s) próximos a las ${t.startTime}. Seguirán programados; reprográmalos si es necesario.`], needsConfirmation: true });
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.timeSlot.update({ where: { id }, data: { active: !t.active } });
      await audit(tx, { userId: user.id, action: t.active ? "DESACTIVAR" : "ACTIVAR", entity: "Horario", entityId: id, summary: `Horario ${t.startTime}` });
    });
    revalidatePath("/configuracion/horarios-canchas");
    return { ok: true, message: t.active ? "Horario desactivado." : "Horario activado." };
  });
}

export async function saveFieldAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const sid = await seasonId();
    const season = await prisma.season.findUniqueOrThrow({ where: { id: sid } });
    const d = parseForm(z.object({ id: zs.optId, name: zs.text(40, "El nombre"), sortOrder: zs.optInt(0, 99) }), fd);
    const dup = await prisma.field.findFirst({ where: { venueId: season.venueId, name: cleanName(d.name), ...(d.id ? { id: { not: d.id } } : {}) } });
    if (dup) throw new ActionError("Ya existe una cancha con ese nombre.", { fieldErrors: { name: "Duplicado" } });
    await prisma.$transaction(async (tx) => {
      const f = d.id
        ? await tx.field.update({ where: { id: d.id }, data: { name: cleanName(d.name), sortOrder: d.sortOrder ?? 0 } })
        : await tx.field.create({ data: { venueId: season.venueId, name: cleanName(d.name), sortOrder: d.sortOrder ?? 0 } });
      await audit(tx, { userId: user.id, action: "CONFIGURACION", entity: "Cancha", entityId: f.id, summary: f.name, after: d });
    });
    revalidatePath("/configuracion/horarios-canchas");
    return { ok: true, message: "Cancha guardada." };
  });
}

export async function toggleFieldAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    const f = await prisma.field.findUniqueOrThrow({ where: { id } });
    if (f.active) {
      const future = await prisma.match.count({ where: { fieldId: id, status: { in: ["PROGRAMADO", "REPROGRAMADO"] }, date: { gte: new Date() } } });
      if (future && !isConfirm(fd)) {
        throw new ActionError("Cancha con partidos programados", { warnings: [`Hay ${future} partido(s) próximos en ${f.name}. Reprográmalos si es necesario.`], needsConfirmation: true });
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.field.update({ where: { id }, data: { active: !f.active } });
      await audit(tx, { userId: user.id, action: f.active ? "DESACTIVAR" : "ACTIVAR", entity: "Cancha", entityId: id, summary: f.name });
    });
    revalidatePath("/configuracion/horarios-canchas");
    return { ok: true, message: f.active ? "Cancha desactivada." : "Cancha activada." };
  });
}

export async function addFieldBlockAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const d = parseForm(z.object({ fieldId: zs.id, date: zs.date, timeSlotId: zs.optId, reason: zs.optText(200) }), fd);
    const date = fromISODate(d.date);
    const busy = await prisma.match.count({ where: { fieldId: d.fieldId, date, status: { not: "CANCELADO" }, ...(d.timeSlotId ? { timeSlotId: d.timeSlotId } : {}) } });
    if (busy && !isConfirm(fd)) {
      throw new ActionError("Hay partidos en ese espacio", { warnings: [`La cancha tiene ${busy} partido(s) en ese periodo. El bloqueo no los mueve automáticamente.`], needsConfirmation: true });
    }
    await prisma.$transaction(async (tx) => {
      const b = await tx.fieldBlock.create({ data: { fieldId: d.fieldId, date, timeSlotId: d.timeSlotId ?? null, reason: d.reason } });
      await audit(tx, { userId: user.id, action: "CONFIGURACION", entity: "Cancha", entityId: d.fieldId, summary: `Bloqueo ${d.date}`, after: { ...d, id: b.id } });
    });
    revalidatePath("/configuracion/horarios-canchas");
    return { ok: true, message: "Bloqueo registrado." };
  });
}

export async function deleteFieldBlockAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    const b = await prisma.fieldBlock.delete({ where: { id } });
    await audit(prisma, { userId: user.id, action: "CONFIGURACION", entity: "Cancha", entityId: b.fieldId, summary: `Bloqueo eliminado ${toISODate(b.date)}` });
    revalidatePath("/configuracion/horarios-canchas");
    return { ok: true, message: "Bloqueo eliminado." };
  });
}

// ───────────────────────── Reglas ─────────────────────────

export async function saveScoringAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const sid = await seasonId();
    const d = parseForm(
      z.object({
        leagueId: zs.optId,
        winPoints: zs.int(0, 20),
        lossPoints: zs.int(0, 20),
        shootoutWinPoints: zs.int(0, 20),
        shootoutLossPoints: zs.int(0, 20),
        allowDraws: zs.bool,
        drawPoints: zs.optInt(0, 20),
        shootoutKicks: zs.optInt(1, 20),
      }),
      fd,
    );
    if (d.allowDraws && d.drawPoints === undefined) {
      throw new ActionError("Indica los puntos del empate definitivo según el reglamento oficial.", { fieldErrors: { drawPoints: "Obligatorio si se permiten empates" } });
    }
    const played = await prisma.match.count({ where: { seasonId: sid, status: "JUGADO", ...(d.leagueId ? { leagueId: d.leagueId } : {}) } });
    if (played && !isConfirm(fd)) {
      throw new ActionError("Ya existen resultados oficiales", { warnings: [`La tabla se recalculará con las nuevas reglas para ${played} partido(s) disputados.`], needsConfirmation: true });
    }
    const data = {
      winPoints: d.winPoints,
      lossPoints: d.lossPoints,
      shootoutWinPoints: d.shootoutWinPoints,
      shootoutLossPoints: d.shootoutLossPoints,
      allowDraws: d.allowDraws,
      drawPoints: d.allowDraws ? (d.drawPoints ?? null) : null,
      shootoutKicks: d.shootoutKicks ?? null,
    };
    await prisma.$transaction(async (tx) => {
      const existing = await tx.scoringConfig.findFirst({ where: { seasonId: sid, leagueId: d.leagueId ?? null } });
      if (existing) await tx.scoringConfig.update({ where: { id: existing.id }, data });
      else await tx.scoringConfig.create({ data: { seasonId: sid, leagueId: d.leagueId ?? null, ...data } });
      await audit(tx, { userId: user.id, action: "CONFIGURACION", entity: "Reglas", entityId: d.leagueId ?? sid, summary: `Puntuación ${d.leagueId ? "de liga" : "de temporada"}`, before: existing ?? undefined, after: data });
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Reglas de puntuación guardadas." };
  });
}

export async function removeLeagueOverrideAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const leagueId = String(fd.get("leagueId"));
    const kind = String(fd.get("kind"));
    if (kind === "scoring") await prisma.scoringConfig.deleteMany({ where: { leagueId } });
    else await prisma.tiebreakConfig.deleteMany({ where: { leagueId } });
    await audit(prisma, { userId: user.id, action: "CONFIGURACION", entity: "Reglas", entityId: leagueId, summary: `Se eliminó la regla específica de liga (${kind}); aplica la de temporada` });
    revalidatePath("/", "layout");
    return { ok: true, message: "La liga ahora usa las reglas generales de la temporada." };
  });
}

export async function saveTiebreakAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const sid = await seasonId();
    const leagueId = (fd.get("leagueId") as string) || null;
    const criteria = fd.getAll("criteria").map(String).filter((c) => c && c in TIEBREAK_CRITERIA);
    const scorerCriteria = fd.getAll("scorerCriteria").map(String).filter((c) => c && c in SCORER_CRITERIA);
    if (new Set(criteria).size !== criteria.length) throw new ActionError("Un criterio aparece más de una vez.");
    if (new Set(scorerCriteria).size !== scorerCriteria.length) throw new ActionError("Un criterio de goleo aparece más de una vez.");
    if (!criteria.length) throw new ActionError("Configura al menos un criterio.");
    if (criteria[0] !== "PUNTOS" && !isConfirm(fd)) {
      throw new ActionError("El primer criterio no es «puntos»", { warnings: ["Normalmente la tabla se ordena primero por puntos. ¿Confirmas este orden?"], needsConfirmation: true });
    }
    await prisma.$transaction(async (tx) => {
      const existing = await tx.tiebreakConfig.findFirst({ where: { seasonId: sid, leagueId } });
      if (existing) await tx.tiebreakConfig.update({ where: { id: existing.id }, data: { criteria, scorerCriteria } });
      else await tx.tiebreakConfig.create({ data: { seasonId: sid, leagueId, criteria, scorerCriteria } });
      await audit(tx, { userId: user.id, action: "CONFIGURACION", entity: "Reglas", entityId: leagueId ?? sid, summary: "Criterios de desempate", before: existing ?? undefined, after: { criteria, scorerCriteria } });
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Criterios de desempate guardados." };
  });
}

// ───────────────────────── Eliminatorias ─────────────────────────

const bracketSchema = z.object({
  stages: z
    .array(
      z.object({
        code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,20}$/, "Código de etapa inválido"),
        name: z.string().trim().min(1).max(40),
        ties: z.array(z.object({ home: z.string().trim().toUpperCase(), away: z.string().trim().toUpperCase() })).min(1),
      }),
    )
    .min(1),
});
const zonesSchema = z.array(
  z.object({
    positions: z.array(z.number().int().min(1).max(200)).min(1),
    label: z.string().trim().min(1).max(80),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
);

export async function savePlayoffFormatAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const sid = await seasonId();
    const leagueId = String(fd.get("leagueId"));
    const closed = await prisma.standingSnapshot.count({ where: { leagueId } });
    if (closed) throw new ActionError("La fase regular ya está cerrada: el cuadro no puede modificarse. Reabre la fase regular si corresponde.");
    let bracket: BracketFormat;
    let zones: Zone[];
    try {
      bracket = bracketSchema.parse(JSON.parse(String(fd.get("stages"))));
      zones = zonesSchema.parse(JSON.parse(String(fd.get("zones") || "[]")));
    } catch {
      throw new ActionError("La estructura del cuadro o de las zonas no es válida. Revisa códigos, nombres, cruces y colores.");
    }
    const teamCount = await prisma.team.count({ where: { leagueId, active: true } });
    const errors = validateBracket(bracket, Math.max(teamCount, 999));
    if (errors.length) throw new ActionError(errors[0], { warnings: errors.slice(1) });
    const sizeIssues = validateBracket(bracket, teamCount).filter((e) => e.includes("solo tiene"));
    if (sizeIssues.length && !isConfirm(fd)) {
      throw new ActionError("El cuadro requiere más equipos de los que tiene la liga actualmente", { warnings: sizeIssues, needsConfirmation: true });
    }
    const officialConfirmed = fd.get("officialConfirmed") === "1";
    await prisma.$transaction(async (tx) => {
      const before = await tx.playoffFormat.findUnique({ where: { leagueId } });
      const data = { stages: JSON.parse(JSON.stringify(bracket)), zones: JSON.parse(JSON.stringify(zones)), officialConfirmed };
      await tx.playoffFormat.upsert({ where: { leagueId }, create: { seasonId: sid, leagueId, ...data }, update: data });
      await audit(tx, { userId: user.id, action: "ELIMINATORIA", entity: "Liga", entityId: leagueId, summary: "Formato de eliminatorias modificado", before: before ? { stages: before.stages, zones: before.zones, confirmado: before.officialConfirmed } : undefined, after: data });
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Formato de eliminatorias guardado." };
  });
}

// ───────────────────────── Temporadas ─────────────────────────

export async function createSeasonAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const d = parseForm(
      z.object({ name: zs.text(80, "El nombre"), startDate: zs.date, copyFrom: zs.optId, copyTeams: zs.bool, copyPlayers: zs.bool, setCurrent: zs.bool }),
      fd,
    );
    const source = d.copyFrom
      ? await prisma.season.findUnique({
          where: { id: d.copyFrom },
          include: { timeSlots: true, leagues: { include: { playoffFormat: true, scoringConfig: true, tiebreakConfig: true } }, scoringConfigs: true, tiebreakConfigs: true },
        })
      : null;
    const base = source ?? (await prisma.season.findFirst({ orderBy: { createdAt: "desc" } }));
    if (!base) throw new ActionError("No hay datos base (torneo/sede). Ejecuta la configuración inicial.");
    const { DEFAULT_BRACKET } = await import("@/domain/bracket");
    const { DEFAULT_TIEBREAKERS } = await import("@/domain/standings");
    const created = await prisma.$transaction(
      async (tx) => {
        if (d.setCurrent) await tx.season.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
        const s = await tx.season.create({
          data: {
            tournamentId: base.tournamentId,
            venueId: base.venueId,
            name: cleanName(d.name),
            startDate: fromISODate(d.startDate),
            // Sin temporada de origen se usa la configuración inicial, no la de otra temporada.
            weekday: source?.weekday ?? 0,
            regularRounds: source?.regularRounds ?? 14,
            allowInterLeague: source?.allowInterLeague ?? true,
            isCurrent: d.setCurrent,
          },
        });
        const slots = source?.timeSlots ?? [];
        const times = slots.length ? slots.map((t) => ({ startTime: t.startTime, durationMinutes: t.durationMinutes, sortOrder: t.sortOrder, active: t.active })) : ["08:10", "09:00", "09:50", "10:40", "11:30", "12:20"].map((t, i) => ({ startTime: t, durationMinutes: 50, sortOrder: i, active: true }));
        await tx.timeSlot.createMany({ data: times.map((t) => ({ ...t, seasonId: s.id })) });
        const seasonScoring = source?.scoringConfigs.find((c) => !c.leagueId);
        await tx.scoringConfig.create({
          data: {
            seasonId: s.id,
            winPoints: seasonScoring?.winPoints ?? 3,
            lossPoints: seasonScoring?.lossPoints ?? 0,
            shootoutWinPoints: seasonScoring?.shootoutWinPoints ?? 2,
            shootoutLossPoints: seasonScoring?.shootoutLossPoints ?? 1,
            allowDraws: seasonScoring?.allowDraws ?? false,
            drawPoints: seasonScoring?.drawPoints ?? null,
            shootoutKicks: seasonScoring ? seasonScoring.shootoutKicks : 3,
          },
        });
        const seasonTb = source?.tiebreakConfigs.find((c) => !c.leagueId);
        await tx.tiebreakConfig.create({ data: { seasonId: s.id, criteria: seasonTb?.criteria ?? DEFAULT_TIEBREAKERS, scorerCriteria: seasonTb?.scorerCriteria ?? [] } });
        const leagues = source?.leagues.length ? source.leagues : [{ id: "", name: "Premium", sortOrder: 0, active: true, playoffFormat: null, scoringConfig: null, tiebreakConfig: null }, { id: "", name: "Liga 2", sortOrder: 1, active: true, playoffFormat: null, scoringConfig: null, tiebreakConfig: null }];
        let teamsCopied = 0;
        for (const l of leagues) {
          const nl = await tx.league.create({ data: { seasonId: s.id, name: l.name, sortOrder: l.sortOrder, active: l.active } });
          await tx.playoffFormat.create({
            data: {
              seasonId: s.id,
              leagueId: nl.id,
              stages: (l.playoffFormat?.stages as object) ?? JSON.parse(JSON.stringify(DEFAULT_BRACKET)),
              zones: (l.playoffFormat?.zones as object) ?? [],
              officialConfirmed: l.playoffFormat?.officialConfirmed ?? true,
            },
          });
          if (l.scoringConfig) {
            const c = l.scoringConfig;
            await tx.scoringConfig.create({
              data: {
                seasonId: s.id,
                leagueId: nl.id,
                winPoints: c.winPoints,
                lossPoints: c.lossPoints,
                shootoutWinPoints: c.shootoutWinPoints,
                shootoutLossPoints: c.shootoutLossPoints,
                allowDraws: c.allowDraws,
                drawPoints: c.drawPoints,
                shootoutKicks: c.shootoutKicks,
              },
            });
          }
          if (l.tiebreakConfig) {
            await tx.tiebreakConfig.create({ data: { seasonId: s.id, leagueId: nl.id, criteria: l.tiebreakConfig.criteria, scorerCriteria: l.tiebreakConfig.scorerCriteria } });
          }
          if (d.copyTeams && l.id) {
            const teams = await tx.team.findMany({ where: { leagueId: l.id, active: true }, include: { players: { where: { active: true } } } });
            for (const t of teams) {
              const nt = await tx.team.create({
                data: { seasonId: s.id, leagueId: nl.id, name: t.name, nameKey: t.nameKey, logo: t.logo, logoMime: t.logoMime, contactName: t.contactName, contactPhone: t.contactPhone, contactEmail: t.contactEmail, isDemo: t.isDemo },
              });
              teamsCopied++;
              if (d.copyPlayers) {
                for (const p of t.players) {
                  const np = await tx.player.create({ data: { seasonId: s.id, teamId: nt.id, fullName: p.fullName, nameKey: p.nameKey, jerseyNumber: p.jerseyNumber, isDemo: p.isDemo } });
                  await tx.playerTeamHistory.create({ data: { playerId: np.id, teamId: nt.id, reason: "Copiado de temporada anterior" } });
                }
              }
            }
          }
        }
        await audit(tx, { userId: user.id, action: "CREAR", entity: "Temporada", entityId: s.id, summary: `${s.name}${source ? ` (copia de ${source.name})` : ""}`, after: { ...d, equiposCopiados: teamsCopied } });
        return s;
      },
      { timeout: 120_000 },
    );
    revalidatePath("/", "layout");
    return { ok: true, message: `Temporada "${created.name}" creada.` };
  });
}

export async function setCurrentSeasonAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    await prisma.$transaction(async (tx) => {
      await tx.season.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
      const s = await tx.season.update({ where: { id }, data: { isCurrent: true } });
      await audit(tx, { userId: user.id, action: "CONFIGURACION", entity: "Temporada", entityId: id, summary: `Temporada vigente: ${s.name}` });
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Temporada vigente actualizada." };
  });
}

export async function setSeasonStatusAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    const status = z.enum(["CONFIGURACION", "EN_CURSO", "FASE_REGULAR_CERRADA", "FINALIZADA"]).parse(fd.get("status"));
    await prisma.$transaction(async (tx) => {
      const before = await tx.season.findUniqueOrThrow({ where: { id } });
      await tx.season.update({ where: { id }, data: { status } });
      await audit(tx, { userId: user.id, action: "CONFIGURACION", entity: "Temporada", entityId: id, summary: `Estado de temporada: ${before.status} → ${status}`, reason: (fd.get("reason") as string) || null });
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Estado actualizado." };
  });
}

// ───────────────────────── Catálogos ─────────────────────────

export async function addSanctionTypeAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const d = parseForm(z.object({ name: zs.text(60, "El nombre") }), fd);
    const all = await prisma.sanctionType.findMany();
    if (all.some((t) => normalizeName(t.name) === normalizeName(d.name))) throw new ActionError("Ese tipo ya existe.");
    const t = await prisma.sanctionType.create({ data: { name: cleanName(d.name) } });
    await audit(prisma, { userId: user.id, action: "CONFIGURACION", entity: "Catálogo", entityId: t.id, summary: `Tipo de sanción: ${t.name}` });
    revalidatePath("/configuracion/catalogos");
    return { ok: true, message: "Tipo agregado." };
  });
}

export async function addSanctionUnitAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const d = parseForm(z.object({ name: zs.text(60, "El nombre"), kind: z.enum(["PARTIDOS", "MINUTOS", "DIAS", "OTRA"]) }), fd);
    const all = await prisma.sanctionUnit.findMany();
    if (all.some((t) => normalizeName(t.name) === normalizeName(d.name))) throw new ActionError("Esa unidad ya existe.");
    const u = await prisma.sanctionUnit.create({ data: { name: cleanName(d.name), kind: d.kind } });
    await audit(prisma, { userId: user.id, action: "CONFIGURACION", entity: "Catálogo", entityId: u.id, summary: `Unidad de sanción: ${u.name}` });
    revalidatePath("/configuracion/catalogos");
    return { ok: true, message: "Unidad agregada." };
  });
}

export async function toggleCatalogAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    const kind = String(fd.get("kind"));
    if (kind === "type") {
      const t = await prisma.sanctionType.findUniqueOrThrow({ where: { id } });
      await prisma.sanctionType.update({ where: { id }, data: { active: !t.active } });
    } else {
      const u = await prisma.sanctionUnit.findUniqueOrThrow({ where: { id } });
      await prisma.sanctionUnit.update({ where: { id }, data: { active: !u.active } });
    }
    await audit(prisma, { userId: user.id, action: "CONFIGURACION", entity: "Catálogo", entityId: id, summary: "Activación/desactivación de catálogo" });
    revalidatePath("/configuracion/catalogos");
    return { ok: true, message: "Catálogo actualizado." };
  });
}
