"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fromISODate, toISODate } from "@/lib/dates";
import { nextStatusAfterServing } from "@/domain/sanctions";
import { ActionError, runAction, type ActionResult } from "../action";
import { audit } from "../audit";
import { getSeasonId } from "../season";
import { parseForm, zs } from "../validation";

const STATUSES = ["ACTIVA", "PENDIENTE", "CUMPLIDA", "CANCELADA", "EN_REVISION"] as const;

const schema = z.object({
  playerId: zs.id,
  matchId: zs.optId,
  date: zs.date,
  typeId: zs.id,
  reason: zs.text(500, "El motivo"),
  duration: zs.int(0, 10000, "La duración"),
  unitId: zs.id,
  status: z.enum(STATUSES),
  notes: zs.optText(1000),
});

function snapshot(s: { status: string; duration: number; reason: string; notes: string | null; date: Date; typeId: string; unitId: string; matchId: string | null }) {
  return { estado: s.status, duracion: s.duration, motivo: s.reason, observaciones: s.notes, fecha: toISODate(s.date), tipo: s.typeId, unidad: s.unitId, partido: s.matchId };
}

export async function createSanctionAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async (user) => {
    const seasonId = await getSeasonId();
    if (!seasonId) throw new ActionError("No hay temporada seleccionada.");
    const d = parseForm(schema, fd);
    const player = await prisma.player.findFirst({ where: { id: d.playerId, seasonId } });
    if (!player) throw new ActionError("Jugador inválido.");
    let teamId = player.teamId;
    if (d.matchId) {
      const m = await prisma.match.findUniqueOrThrow({ where: { id: d.matchId } });
      const hist = await prisma.playerTeamHistory.findMany({ where: { playerId: player.id }, select: { teamId: true } });
      const teams = new Set([player.teamId, ...hist.map((h) => h.teamId)]);
      const matchTeam = [m.homeTeamId, m.awayTeamId].find((t) => teams.has(t));
      if (!matchTeam) throw new ActionError("El jugador no pertenece a ninguno de los equipos del partido.");
      teamId = matchTeam;
    }
    const s = await prisma.$transaction(async (tx) => {
      const created = await tx.sanction.create({
        data: { seasonId, playerId: player.id, teamId, matchId: d.matchId ?? null, date: fromISODate(d.date), typeId: d.typeId, reason: d.reason, duration: d.duration, unitId: d.unitId, status: d.status, notes: d.notes },
      });
      await audit(tx, { userId: user.id, action: "SANCION", entity: "Sanción", entityId: created.id, summary: `Alta de sanción: ${player.fullName}`, after: snapshot(created) });
      return created;
    });
    revalidatePath("/sanciones");
    return { ok: true, message: "Sanción registrada.", data: { id: s.id } };
  });
}

export async function updateSanctionAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    const d = parseForm(schema.omit({ playerId: true }).extend({ changeReason: zs.text(300, "El motivo del cambio") }), fd);
    const before = await prisma.sanction.findUniqueOrThrow({ where: { id } });
    await prisma.$transaction(async (tx) => {
      const after = await tx.sanction.update({
        where: { id },
        data: { matchId: d.matchId ?? null, date: fromISODate(d.date), typeId: d.typeId, reason: d.reason, duration: d.duration, unitId: d.unitId, status: d.status, notes: d.notes ?? null },
      });
      await audit(tx, { userId: user.id, action: "SANCION", entity: "Sanción", entityId: id, summary: "Modificación de sanción", before: snapshot(before), after: snapshot(after), reason: d.changeReason });
    });
    revalidatePath(`/sanciones/${id}`);
    revalidatePath("/sanciones");
    return { ok: true, message: "Sanción actualizada." };
  });
}

export async function addServingAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const d = parseForm(z.object({ sanctionId: zs.id, matchId: zs.optId, date: zs.optDate, notes: zs.optText(300) }), fd);
    const s = await prisma.sanction.findUniqueOrThrow({ where: { id: d.sanctionId }, include: { unit: true, _count: { select: { servings: true } } } });
    if (s.status === "CANCELADA") throw new ActionError("La sanción está cancelada.");
    let date = d.date ? fromISODate(d.date) : null;
    if (d.matchId) {
      const m = await prisma.match.findUniqueOrThrow({ where: { id: d.matchId } });
      if (m.homeTeamId !== s.teamId && m.awayTeamId !== s.teamId) throw new ActionError("El partido no corresponde al equipo del jugador sancionado.");
      if (m.status === "CANCELADO") throw new ActionError("Un partido cancelado no cuenta como cumplimiento.");
      date = m.date;
    }
    if (!date) throw new ActionError("Indica el partido o la fecha del cumplimiento.");
    if (s.unit.kind === "PARTIDOS" && s._count.servings >= s.duration) throw new ActionError("La sanción ya tiene todos sus partidos cumplidos.");
    await prisma.$transaction(async (tx) => {
      await tx.sanctionServing.create({ data: { sanctionId: s.id, matchId: d.matchId ?? null, date, notes: d.notes } });
      const count = s._count.servings + 1;
      const status = nextStatusAfterServing(s.status, s.unit.kind, s.duration, count);
      if (status !== s.status) await tx.sanction.update({ where: { id: s.id }, data: { status } });
      await audit(tx, {
        userId: user.id, action: "SANCION", entity: "Sanción", entityId: s.id,
        summary: `Cumplimiento registrado (${count}${s.unit.kind === "PARTIDOS" ? ` de ${s.duration}` : ""})`,
        before: { estado: s.status }, after: { estado: status, fecha: toISODate(date) },
      });
    });
    revalidatePath(`/sanciones/${s.id}`);
    return { ok: true, message: "Cumplimiento registrado." };
  });
}

export async function removeServingAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    const reason = String(fd.get("reason") ?? "").trim();
    if (!reason) throw new ActionError("Indica el motivo.", { fieldErrors: { reason: "Obligatorio" } });
    const serving = await prisma.sanctionServing.findUniqueOrThrow({ where: { id }, include: { sanction: { include: { unit: true, _count: { select: { servings: true } } } } } });
    const s = serving.sanction;
    await prisma.$transaction(async (tx) => {
      await tx.sanctionServing.delete({ where: { id } });
      const status = nextStatusAfterServing(s.status, s.unit.kind, s.duration, s._count.servings - 1);
      if (status !== s.status) await tx.sanction.update({ where: { id: s.id }, data: { status } });
      await audit(tx, { userId: user.id, action: "SANCION", entity: "Sanción", entityId: s.id, summary: "Cumplimiento eliminado", before: { estado: s.status }, after: { estado: status }, reason });
    });
    revalidatePath(`/sanciones/${s.id}`);
    return { ok: true, message: "Cumplimiento eliminado." };
  });
}
