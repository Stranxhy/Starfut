"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cleanName, normalizeName } from "@/domain/text";
import { ActionError, runAction, type ActionResult } from "../action";
import { audit } from "../audit";
import { getSeasonId } from "../season";
import { isConfirm, parseCsv, parseForm, zs } from "../validation";

// ───────────────────────────── Jugadores ─────────────────────────────

const playerSchema = z.object({
  fullName: zs.text(80, "El nombre"),
  teamId: zs.id,
  jerseyNumber: zs.optInt(0, 999),
});

async function duplicateWarning(teamId: string, nameKey: string, excludeId?: string) {
  const dup = await prisma.player.findFirst({ where: { teamId, nameKey, ...(excludeId ? { id: { not: excludeId } } : {}) } });
  return dup ? `Ya existe un jugador con el nombre "${dup.fullName}" en este equipo.` : null;
}

export async function createPlayerAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const seasonId = await getSeasonId();
    const d = parseForm(playerSchema, fd);
    const team = await prisma.team.findFirst({ where: { id: d.teamId, seasonId: seasonId ?? undefined } });
    if (!team) throw new ActionError("Selecciona un equipo válido.");
    const nameKey = normalizeName(d.fullName);
    const dup = await duplicateWarning(team.id, nameKey);
    if (dup && !isConfirm(fd)) throw new ActionError("Posible duplicado", { warnings: [dup], needsConfirmation: true });
    await prisma.$transaction(async (tx) => {
      const p = await tx.player.create({
        data: { seasonId: team.seasonId, teamId: team.id, fullName: cleanName(d.fullName), nameKey, jerseyNumber: d.jerseyNumber ?? null },
      });
      await tx.playerTeamHistory.create({ data: { playerId: p.id, teamId: team.id, reason: "Alta" } });
      await audit(tx, { userId: user.id, action: "CREAR", entity: "Jugador", entityId: p.id, summary: `${p.fullName} (${team.name})`, after: d });
    });
    revalidatePath("/jugadores");
    return { ok: true, message: "Jugador registrado." };
  });
}

export async function updatePlayerAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    const d = parseForm(playerSchema.omit({ teamId: true }), fd);
    const before = await prisma.player.findUniqueOrThrow({ where: { id } });
    await prisma.$transaction(async (tx) => {
      await tx.player.update({ where: { id }, data: { fullName: cleanName(d.fullName), nameKey: normalizeName(d.fullName), jerseyNumber: d.jerseyNumber ?? null } });
      await audit(tx, {
        userId: user.id, action: "EDITAR", entity: "Jugador", entityId: id, summary: d.fullName,
        before: { nombre: before.fullName, numero: before.jerseyNumber }, after: { nombre: d.fullName, numero: d.jerseyNumber ?? null },
      });
    });
    revalidatePath(`/jugadores/${id}`);
    return { ok: true, message: "Jugador actualizado." };
  });
}

/** Cambio de equipo: conserva el historial; goles y sanciones permanecen con el equipo original. */
export async function transferPlayerAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const d = parseForm(z.object({ id: zs.id, teamId: zs.id, reason: zs.text(300, "El motivo") }), fd);
    const p = await prisma.player.findUniqueOrThrow({ where: { id: d.id }, include: { team: true } });
    if (p.teamId === d.teamId) throw new ActionError("El jugador ya pertenece a ese equipo.");
    const target = await prisma.team.findFirst({ where: { id: d.teamId, seasonId: p.seasonId } });
    if (!target) throw new ActionError("Equipo destino inválido.");
    const active = await prisma.sanction.count({ where: { playerId: p.id, status: { in: ["ACTIVA", "PENDIENTE", "EN_REVISION"] } } });
    if (active && !isConfirm(fd)) {
      throw new ActionError("El jugador tiene sanciones vigentes", {
        warnings: [`${p.fullName} tiene ${active} sanción(es) vigente(s). Las sanciones no se transfieren automáticamente; revisa las reglas de la liga.`],
        needsConfirmation: true,
      });
    }
    await prisma.$transaction(async (tx) => {
      await tx.playerTeamHistory.updateMany({ where: { playerId: p.id, toDate: null }, data: { toDate: new Date() } });
      await tx.playerTeamHistory.create({ data: { playerId: p.id, teamId: target.id, reason: d.reason } });
      await tx.player.update({ where: { id: p.id }, data: { teamId: target.id } });
      await audit(tx, {
        userId: user.id, action: "EDITAR", entity: "Jugador", entityId: p.id, summary: `${p.fullName}: cambio de equipo`,
        before: { equipo: p.team.name }, after: { equipo: target.name }, reason: d.reason,
      });
    });
    revalidatePath(`/jugadores/${p.id}`);
    return { ok: true, message: `${p.fullName} ahora pertenece a ${target.name}. Su historial se conserva.` };
  });
}

export async function setPlayerActiveAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    const active = fd.get("active") === "1";
    await prisma.$transaction(async (tx) => {
      const p = await tx.player.update({ where: { id }, data: { active } });
      await audit(tx, { userId: user.id, action: active ? "ACTIVAR" : "DESACTIVAR", entity: "Jugador", entityId: id, summary: p.fullName, reason: (fd.get("reason") as string) || null });
    });
    revalidatePath(`/jugadores/${id}`);
    revalidatePath("/jugadores");
    return { ok: true, message: active ? "Jugador activado." : "Jugador desactivado." };
  });
}

/** CSV: nombre, equipo, numero (encabezado opcional). */
export async function importPlayersCsvAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const seasonId = await getSeasonId();
    if (!seasonId) throw new ActionError("No hay temporada seleccionada.");
    let text = String(fd.get("csv") ?? "");
    const file = fd.get("file");
    if (file instanceof File && file.size > 0) {
      if (file.size > 1024 * 1024) throw new ActionError("El archivo no debe superar 1 MB.");
      text = await file.text();
    }
    const rows = parseCsv(text);
    if (!rows.length) throw new ActionError("No se encontraron filas.");
    const teams = await prisma.team.findMany({ where: { seasonId } });
    const byName = new Map(teams.map((t) => [normalizeName(t.name), t]));
    const header = rows[0].map(normalizeName);
    const hasHeader = header.includes("NOMBRE") || header.includes("JUGADOR");
    const idx = (names: string[], fb: number) => (hasHeader ? header.findIndex((h) => names.includes(h)) : fb);
    const cName = idx(["NOMBRE", "JUGADOR"], 0);
    const cTeam = idx(["EQUIPO"], 1);
    const cNum = idx(["NUMERO", "CAMISETA", "DORSAL"], 2);
    const defaultTeamId = String(fd.get("teamId") ?? "");
    const errors: string[] = [];
    const created: { name: string; teamId: string; num: number | null }[] = [];
    const existing = await prisma.player.findMany({ where: { seasonId }, select: { teamId: true, nameKey: true } });
    const seen = new Set(existing.map((e) => `${e.teamId}|${e.nameKey}`));
    (hasHeader ? rows.slice(1) : rows).forEach((r, i) => {
      const line = i + (hasHeader ? 2 : 1);
      const name = cleanName(r[cName] ?? "");
      if (!name) return errors.push(`Fila ${line}: sin nombre.`);
      const teamCell = cTeam >= 0 ? r[cTeam] : "";
      const team = teamCell ? byName.get(normalizeName(teamCell)) : teams.find((t) => t.id === defaultTeamId);
      if (!team) return errors.push(`Fila ${line}: equipo "${teamCell || "(sin equipo)"}" no existe.`);
      const key = `${team.id}|${normalizeName(name)}`;
      if (seen.has(key)) return errors.push(`Fila ${line}: "${name}" ya existe en ${team.name} (omitido).`);
      seen.add(key);
      const n = cNum >= 0 && r[cNum] ? Number.parseInt(r[cNum], 10) : NaN;
      created.push({ name, teamId: team.id, num: Number.isFinite(n) ? n : null });
    });
    if (!created.length) throw new ActionError("No hay jugadores nuevos válidos.", { warnings: errors });
    await prisma.$transaction(
      async (tx) => {
        for (const c of created) {
          const p = await tx.player.create({ data: { seasonId, teamId: c.teamId, fullName: c.name, nameKey: normalizeName(c.name), jerseyNumber: c.num } });
          await tx.playerTeamHistory.create({ data: { playerId: p.id, teamId: c.teamId, reason: "Importación CSV" } });
        }
        await audit(tx, { userId: user.id, action: "CREAR", entity: "Jugador", summary: `Importación CSV: ${created.length} jugador(es)` });
      },
      { timeout: 60_000 },
    );
    revalidatePath("/jugadores");
    return { ok: true, message: `${created.length} jugador(es) importado(s).`, warnings: errors.length ? errors : undefined };
  });
}
