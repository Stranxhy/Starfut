"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fromISODate, todayISO } from "@/lib/dates";
import { cleanName, normalizeName } from "@/domain/text";
import { ActionError, runAction, type ActionResult } from "../action";
import { audit } from "../audit";
import { getSeasonId } from "../season";
import { isConfirm, parseCsv, parseForm, zs } from "../validation";

async function seasonOrThrow() {
  const id = await getSeasonId();
  if (!id) throw new ActionError("No hay temporada seleccionada.");
  return id;
}

// ───────────────────────────── Ligas ─────────────────────────────

const leagueSchema = z.object({ name: zs.text(60, "El nombre"), sortOrder: zs.optInt(0, 99) });

export async function createLeagueAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const seasonId = await seasonOrThrow();
    const data = parseForm(leagueSchema, fd);
    const { DEFAULT_BRACKET } = await import("@/domain/bracket");
    await prisma.$transaction(async (tx) => {
      const league = await tx.league.create({ data: { seasonId, name: cleanName(data.name), sortOrder: data.sortOrder ?? 0 } });
      await tx.playoffFormat.create({ data: { seasonId, leagueId: league.id, stages: JSON.parse(JSON.stringify(DEFAULT_BRACKET)), zones: [], officialConfirmed: true } });
      await audit(tx, { userId: user.id, action: "CREAR", entity: "Liga", entityId: league.id, summary: league.name, after: data });
    });
    revalidatePath("/ligas");
    return { ok: true, message: "Liga creada." };
  });
}

export async function updateLeagueAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    const data = parseForm(leagueSchema, fd);
    const before = await prisma.league.findUniqueOrThrow({ where: { id } });
    await prisma.$transaction(async (tx) => {
      await tx.league.update({ where: { id }, data: { name: cleanName(data.name), sortOrder: data.sortOrder ?? before.sortOrder } });
      await audit(tx, { userId: user.id, action: "EDITAR", entity: "Liga", entityId: id, summary: data.name, before: { nombre: before.name }, after: { nombre: data.name } });
    });
    revalidatePath("/ligas");
    return { ok: true, message: "Liga actualizada." };
  });
}

export async function setLeagueActiveAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    const active = fd.get("active") === "1";
    await prisma.$transaction(async (tx) => {
      const l = await tx.league.update({ where: { id }, data: { active } });
      await audit(tx, { userId: user.id, action: active ? "ACTIVAR" : "DESACTIVAR", entity: "Liga", entityId: id, summary: l.name, reason: (fd.get("reason") as string) || null });
    });
    revalidatePath("/ligas");
    return { ok: true, message: active ? "Liga activada." : "Liga desactivada." };
  });
}

// ───────────────────────────── Equipos ─────────────────────────────

const teamSchema = z.object({
  name: zs.text(60, "El nombre"),
  leagueId: zs.id,
  contactName: zs.optText(80),
  contactPhone: zs.phone,
  contactEmail: zs.email,
  notes: zs.optText(500),
});

async function calendarImpactWarning(seasonId: string): Promise<string | null> {
  const locked = await prisma.round.count({ where: { seasonId, phase: "REGULAR", locked: true } });
  return locked
    ? "El calendario de la temporada ya está confirmado. El cambio no modifica automáticamente las jornadas: revisa el calendario y, si es necesario, regenera las jornadas pendientes."
    : null;
}

export async function createTeamAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async (user) => {
    const seasonId = await seasonOrThrow();
    const data = parseForm(teamSchema, fd);
    const league = await prisma.league.findFirst({ where: { id: data.leagueId, seasonId } });
    if (!league) throw new ActionError("Selecciona una liga válida de la temporada.");
    const nameKey = normalizeName(data.name);
    const dup = await prisma.team.findUnique({ where: { leagueId_nameKey: { leagueId: league.id, nameKey } } });
    if (dup) throw new ActionError(`Ya existe un equipo llamado "${dup.name}" en ${league.name}.`, { fieldErrors: { name: "Nombre duplicado en la liga" } });
    const impact = await calendarImpactWarning(seasonId);
    if (impact && !isConfirm(fd)) throw new ActionError("Incorporación durante la temporada", { warnings: [impact], needsConfirmation: true });
    const team = await prisma.$transaction(async (tx) => {
      const t = await tx.team.create({
        data: { seasonId, leagueId: league.id, name: cleanName(data.name), nameKey, contactName: data.contactName, contactPhone: data.contactPhone, contactEmail: data.contactEmail, notes: data.notes },
      });
      await audit(tx, { userId: user.id, action: "CREAR", entity: "Equipo", entityId: t.id, summary: `${t.name} (${league.name})`, after: data, reason: impact ? "Alta con calendario confirmado" : null });
      return t;
    });
    revalidatePath("/equipos");
    return { ok: true, message: "Equipo registrado.", data: { id: team.id } };
  });
}

export async function updateTeamAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    const data = parseForm(teamSchema, fd);
    const before = await prisma.team.findUniqueOrThrow({ where: { id }, include: { league: true } });
    const nameKey = normalizeName(data.name);
    if (data.leagueId !== before.leagueId) {
      const matches = await prisma.match.count({ where: { OR: [{ homeTeamId: id }, { awayTeamId: id }], status: { not: "CANCELADO" } } });
      if (matches) throw new ActionError("El equipo ya tiene partidos: no se puede cambiar de liga. Da de baja el equipo y regístralo en la otra liga.");
    }
    const dup = await prisma.team.findFirst({ where: { leagueId: data.leagueId, nameKey, id: { not: id } } });
    if (dup) throw new ActionError(`Ya existe un equipo llamado "${dup.name}" en esa liga.`, { fieldErrors: { name: "Nombre duplicado" } });
    await prisma.$transaction(async (tx) => {
      await tx.team.update({
        where: { id },
        data: { name: cleanName(data.name), nameKey, leagueId: data.leagueId, contactName: data.contactName ?? null, contactPhone: data.contactPhone ?? null, contactEmail: data.contactEmail ?? null, notes: data.notes ?? null },
      });
      await audit(tx, {
        userId: user.id, action: "EDITAR", entity: "Equipo", entityId: id, summary: data.name,
        before: { nombre: before.name, liga: before.leagueId, contacto: before.contactName, telefono: before.contactPhone, correo: before.contactEmail },
        after: { nombre: data.name, liga: data.leagueId, contacto: data.contactName, telefono: data.contactPhone, correo: data.contactEmail },
      });
    });
    revalidatePath(`/equipos/${id}`);
    return { ok: true, message: "Equipo actualizado." };
  });
}

/** Baja lógica: el historial se conserva. Opcionalmente cancela sus partidos futuros. */
export async function setTeamActiveAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    const active = fd.get("active") === "1";
    const cancelFuture = fd.get("cancelFuture") === "1";
    const reason = String(fd.get("reason") ?? "").trim();
    const team = await prisma.team.findUniqueOrThrow({ where: { id } });
    const today = fromISODate(todayISO());
    const upcoming = await prisma.match.findMany({
      where: {
        AND: [{ OR: [{ homeTeamId: id }, { awayTeamId: id }] }, { OR: [{ date: { gte: today } }, { date: null }] }],
        status: { in: ["PROGRAMADO", "REPROGRAMADO", "PENDIENTE"] },
      },
      select: { id: true },
    });
    if (!active && !reason) throw new ActionError("Indica el motivo de la baja.", { fieldErrors: { reason: "Obligatorio" } });
    if (!active && upcoming.length && !isConfirm(fd) && !cancelFuture) {
      throw new ActionError("Impacto en el calendario", {
        warnings: [
          `${team.name} tiene ${upcoming.length} partido(s) pendientes. Si confirmas sin marcar "cancelar partidos pendientes", seguirán programados y aparecerán como alerta.`,
        ],
        needsConfirmation: true,
      });
    }
    await prisma.$transaction(async (tx) => {
      await tx.team.update({ where: { id }, data: { active, deactivatedAt: active ? null : new Date() } });
      if (!active && cancelFuture && upcoming.length) {
        await tx.match.updateMany({ where: { id: { in: upcoming.map((m) => m.id) }, result: { is: null } }, data: { status: "CANCELADO", cancelReason: `Baja del equipo: ${reason}` } });
        for (const m of upcoming) {
          await audit(tx, { userId: user.id, action: "CANCELAR", entity: "Partido", entityId: m.id, summary: `Cancelado por baja de ${team.name}`, reason });
        }
      }
      await audit(tx, {
        userId: user.id, action: active ? "ACTIVAR" : "DESACTIVAR", entity: "Equipo", entityId: id, summary: team.name,
        after: { activo: active, partidosCancelados: !active && cancelFuture ? upcoming.length : 0 }, reason: reason || null,
      });
    });
    revalidatePath("/equipos");
    revalidatePath(`/equipos/${id}`);
    return { ok: true, message: active ? "Equipo reactivado." : "Equipo dado de baja. Su historial se conserva." };
  });
}

export async function uploadTeamLogoAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    const file = fd.get("logo");
    if (fd.get("remove") === "1") {
      await prisma.team.update({ where: { id }, data: { logo: null, logoMime: null } });
      await audit(prisma, { userId: user.id, action: "EDITAR", entity: "Equipo", entityId: id, summary: "Escudo eliminado" });
      revalidatePath(`/equipos/${id}`);
      return { ok: true, message: "Escudo eliminado." };
    }
    if (!(file instanceof File) || file.size === 0) throw new ActionError("Selecciona una imagen.");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new ActionError("Formato no permitido (PNG, JPG o WEBP).");
    if (file.size > 512 * 1024) throw new ActionError("La imagen no debe superar 512 KB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    await prisma.team.update({ where: { id }, data: { logo: bytes, logoMime: file.type } });
    await audit(prisma, { userId: user.id, action: "EDITAR", entity: "Equipo", entityId: id, summary: "Escudo actualizado" });
    revalidatePath(`/equipos/${id}`);
    return { ok: true, message: "Escudo actualizado." };
  });
}

/** Importación CSV: columnas nombre, liga, contacto, telefono, correo (encabezado opcional). */
export async function importTeamsCsvAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const seasonId = await seasonOrThrow();
    let text = String(fd.get("csv") ?? "");
    const file = fd.get("file");
    if (file instanceof File && file.size > 0) {
      if (file.size > 1024 * 1024) throw new ActionError("El archivo no debe superar 1 MB.");
      text = await file.text();
    }
    const rows = parseCsv(text);
    if (!rows.length) throw new ActionError("No se encontraron filas para importar.");
    const leagues = await prisma.league.findMany({ where: { seasonId } });
    const byName = new Map(leagues.map((l) => [normalizeName(l.name), l]));
    const defaultLeagueId = String(fd.get("leagueId") ?? "");
    const header = rows[0].map((h) => normalizeName(h));
    const hasHeader = header.includes("NOMBRE") || header.includes("EQUIPO");
    const col = (names: string[], fallback: number) => {
      const i = header.findIndex((h) => names.includes(h));
      return hasHeader ? i : fallback;
    };
    const cName = col(["NOMBRE", "EQUIPO"], 0);
    const cLeague = col(["LIGA"], 1);
    const cContact = col(["CONTACTO", "RESPONSABLE"], 2);
    const cPhone = col(["TELEFONO", "CELULAR"], 3);
    const cMail = col(["CORREO", "EMAIL"], 4);
    const errors: string[] = [];
    const toCreate: { name: string; nameKey: string; leagueId: string; contactName?: string; contactPhone?: string; contactEmail?: string }[] = [];
    const existing = await prisma.team.findMany({ where: { seasonId }, select: { leagueId: true, nameKey: true } });
    const seen = new Set(existing.map((e) => `${e.leagueId}|${e.nameKey}`));
    (hasHeader ? rows.slice(1) : rows).forEach((r, i) => {
      const line = i + (hasHeader ? 2 : 1);
      const name = cleanName(r[cName] ?? "");
      if (!name) return errors.push(`Fila ${line}: sin nombre.`);
      const leagueCell = cLeague >= 0 ? r[cLeague] : "";
      const league = leagueCell ? byName.get(normalizeName(leagueCell)) : leagues.find((l) => l.id === defaultLeagueId);
      if (!league) return errors.push(`Fila ${line}: liga "${leagueCell || "(sin liga)"}" no existe.`);
      const nameKey = normalizeName(name);
      if (seen.has(`${league.id}|${nameKey}`)) return errors.push(`Fila ${line}: "${name}" ya existe en ${league.name} (omitido).`);
      seen.add(`${league.id}|${nameKey}`);
      toCreate.push({
        name, nameKey, leagueId: league.id,
        contactName: (cContact >= 0 && r[cContact]) || undefined,
        contactPhone: (cPhone >= 0 && r[cPhone]) || undefined,
        contactEmail: (cMail >= 0 && r[cMail]) || undefined,
      });
    });
    if (!toCreate.length) throw new ActionError("No hay equipos nuevos válidos para importar.", { warnings: errors });
    await prisma.$transaction(async (tx) => {
      await tx.team.createMany({ data: toCreate.map((t) => ({ ...t, seasonId })) });
      await audit(tx, { userId: user.id, action: "CREAR", entity: "Equipo", summary: `Importación CSV: ${toCreate.length} equipo(s)`, after: toCreate.map((t) => t.name) });
    });
    revalidatePath("/equipos");
    return { ok: true, message: `${toCreate.length} equipo(s) importado(s).`, warnings: errors.length ? errors : undefined };
  });
}

const restrictionSchema = z.object({ teamId: zs.id, date: zs.optDate, timeSlotId: zs.optId, reason: zs.optText(200) });

export async function addTeamRestrictionAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const d = parseForm(restrictionSchema, fd);
    if (!d.date && !d.timeSlotId) throw new ActionError("Indica una fecha, un horario o ambos.");
    await prisma.$transaction(async (tx) => {
      const r = await tx.teamRestriction.create({ data: { teamId: d.teamId, date: d.date ? fromISODate(d.date) : null, timeSlotId: d.timeSlotId ?? null, reason: d.reason } });
      await audit(tx, { userId: user.id, action: "CREAR", entity: "RestriccionEquipo", entityId: r.id, summary: "Restricción de disponibilidad", after: d });
    });
    revalidatePath(`/equipos/${d.teamId}`);
    return { ok: true, message: "Restricción registrada." };
  });
}

export async function deleteTeamRestrictionAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    const r = await prisma.teamRestriction.delete({ where: { id } });
    await audit(prisma, { userId: user.id, action: "ELIMINAR", entity: "RestriccionEquipo", entityId: id, summary: "Restricción eliminada", before: r });
    revalidatePath(`/equipos/${r.teamId}`);
    return { ok: true, message: "Restricción eliminada." };
  });
}
