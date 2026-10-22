"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { MatchType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ActionError, runAction, type ActionResult } from "../action";
import { getSeasonId } from "../season";
import { isConfirm, parseForm, zs } from "../validation";
import { cancelMatch, createMatch, freeSlots, updateMatch } from "../services/matches";
import { getCurrentUser } from "../auth";

const matchSchema = z.object({
  type: z.enum(["OFICIAL", "SUSTITUCION", "AMISTOSO", "INTERLIGA"], { errorMap: () => ({ message: "Selecciona la naturaleza del partido" }) }),
  homeTeamId: zs.id,
  awayTeamId: zs.id,
  date: zs.optDate,
  timeSlotId: zs.optId,
  fieldId: zs.optId,
  refereeId: zs.optId,
  countsForStandings: zs.bool,
  notes: zs.optText(500),
  replacesMatchId: zs.optId,
  reason: zs.optText(300),
});

export async function createMatchAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async (user) => {
    const seasonId = await getSeasonId();
    if (!seasonId) throw new ActionError("No hay temporada seleccionada.");
    const d = parseForm(matchSchema, fd);
    if (d.replacesMatchId && d.type === "OFICIAL") {
      throw new ActionError('Un partido que sustituye a otro debe definirse como "Sustitución", "Amistoso" o "Extraordinario entre ligas".');
    }
    const { match, warnings } = await createMatch(
      seasonId,
      {
        type: d.type as MatchType,
        homeTeamId: d.homeTeamId,
        awayTeamId: d.awayTeamId,
        date: d.date ?? null,
        timeSlotId: d.timeSlotId ?? null,
        fieldId: d.fieldId ?? null,
        refereeId: d.refereeId ?? null,
        countsForStandings: d.countsForStandings,
        notes: d.notes,
        replacesMatchId: d.replacesMatchId ?? null,
      },
      { confirm: isConfirm(fd), userId: user.id, reason: d.reason },
    );
    revalidatePath("/partidos");
    return { ok: true, message: "Partido creado.", warnings: warnings.length ? warnings : undefined, data: { id: match.id } };
  });
}

export async function updateMatchAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    const d = parseForm(matchSchema.partial({ type: true, homeTeamId: true, awayTeamId: true }), fd);
    const reschedule = fd.get("reschedule") === "1";
    const { warnings } = await updateMatch(
      id,
      {
        type: d.type as MatchType | undefined,
        homeTeamId: d.homeTeamId,
        awayTeamId: d.awayTeamId,
        date: d.date ?? null,
        timeSlotId: d.timeSlotId ?? null,
        fieldId: d.fieldId ?? null,
        refereeId: d.refereeId ?? null,
        countsForStandings: fd.has("countsForStandingsField") ? d.countsForStandings : undefined,
        notes: fd.has("notes") ? (d.notes ?? null) : undefined,
        reason: d.reason,
      },
      { confirm: isConfirm(fd), userId: user.id, markRescheduled: reschedule },
    );
    revalidatePath(`/partidos/${id}`);
    revalidatePath("/partidos");
    return { ok: true, message: reschedule ? "Partido reprogramado." : "Partido actualizado.", warnings: warnings.length ? warnings : undefined };
  });
}

export async function assignRefereeAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    const refereeId = String(fd.get("refereeId") ?? "") || null;
    const reason = String(fd.get("reason") ?? "") || null;
    await updateMatch(id, { refereeId, reason }, { confirm: isConfirm(fd), userId: user.id });
    revalidatePath("/partidos");
    return { ok: true, message: "Árbitro asignado." };
  });
}

export async function cancelMatchAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const d = parseForm(z.object({ id: zs.id, reason: zs.text(300, "El motivo") }), fd);
    await cancelMatch(d.id, d.reason, user.id);
    revalidatePath(`/partidos/${d.id}`);
    revalidatePath("/partidos");
    return { ok: true, message: "Partido cancelado. El espacio quedó libre y el historial se conserva." };
  });
}

/** Espacios libres de una fecha (para sugerencias en el formulario). */
export async function freeSlotsAction(date: string) {
  const user = await getCurrentUser();
  const seasonId = await getSeasonId();
  if (!user || !seasonId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  return freeSlots(seasonId, date);
}

/** Árbitros activos libres en una fecha y horario. */
export async function freeRefereesAction(date: string, timeSlotId: string, excludeMatchId?: string) {
  const user = await getCurrentUser();
  const seasonId = await getSeasonId();
  if (!user || !seasonId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const d = new Date(`${date}T00:00:00Z`);
  const [refs, busy, unavailable] = await Promise.all([
    prisma.referee.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.match.findMany({
      where: { date: d, timeSlotId, status: { not: "CANCELADO" }, refereeId: { not: null }, ...(excludeMatchId ? { id: { not: excludeMatchId } } : {}) },
      select: { refereeId: true },
    }),
    prisma.refereeAvailability.findMany({ where: { date: d, available: false, OR: [{ timeSlotId: null }, { timeSlotId }] } }),
  ]);
  const blocked = new Set([...busy.map((b) => b.refereeId!), ...unavailable.map((u) => u.refereeId)]);
  return refs.filter((r) => !blocked.has(r.id));
}

const fillItem = z.object({
  home: z.string().min(1),
  away: z.string().min(1),
  timeSlotId: z.string().nullable(),
  fieldId: z.string().nullable(),
  refereeId: z.string().nullable(),
  crossLeague: z.boolean(),
});

/** Crea los partidos propuestos para que ningún equipo se quede sin jugar en la fecha. */
export async function fillDayAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const seasonId = await getSeasonId();
    if (!seasonId) throw new ActionError("No hay temporada seleccionada.");
    const date = String(fd.get("date") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ActionError("Fecha inválida.");
    let items: z.infer<typeof fillItem>[];
    try {
      items = z.array(fillItem).parse(JSON.parse(String(fd.get("items") ?? "[]")));
    } catch {
      throw new ActionError("La propuesta no es válida. Recarga la página.");
    }
    if (!items.length) throw new ActionError("Selecciona al menos un partido.");
    const created: string[] = [];
    const errors: string[] = [];
    for (const it of items) {
      try {
        await createMatch(
          seasonId,
          {
            // Todos los partidos cuentan para la tabla (regla de la liga).
            type: it.crossLeague ? "INTERLIGA" : "SUSTITUCION",
            homeTeamId: it.home,
            awayTeamId: it.away,
            date,
            timeSlotId: it.timeSlotId,
            fieldId: it.fieldId,
            refereeId: it.refereeId,
            notes: it.crossLeague ? "Partido combinado entre ligas para completar la jornada" : "Partido para completar la jornada",
          },
          { confirm: true, userId: user.id, reason: "Completar jornada: equipos sin partido" },
        );
        created.push(it.home);
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "Error al crear un partido.");
      }
    }
    revalidatePath("/", "layout");
    if (!created.length) return { ok: false, error: errors[0] ?? "No se creó ningún partido.", warnings: errors.slice(1) };
    return { ok: true, message: `${created.length} partido(s) creados. Ya aparecen en el rol de su liga.`, warnings: errors.length ? errors : undefined };
  });
}
