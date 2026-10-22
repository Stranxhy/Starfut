"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, runAction, type ActionResult } from "../action";
import { getSeasonId } from "../season";
import { isConfirm, parseForm, zs } from "../validation";
import { confirmDraft, createDraft, discardDraft, getActiveDraft, setRoundLock, updateRoundDate } from "../services/schedule";

export async function generateDraftAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const seasonId = await getSeasonId();
    if (!seasonId) throw new ActionError("No hay temporada seleccionada.");
    const fromRound = Number(fd.get("fromRound"));
    const dates = fd.getAll("dates").map(String).filter(Boolean);
    const leagueIds = fd.getAll("leagueIds").map(String);
    if (!leagueIds.length) throw new ActionError("Selecciona al menos una liga.");
    for (const d of dates) if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new ActionError(`Fecha inválida: ${d}`);
    const seed = fd.get("seed") ? Number(fd.get("seed")) : Math.floor(Math.random() * 1_000_000_000);
    const { data } = await createDraft(seasonId, { fromRound, dates, seed, leagueIds }, user.id);
    revalidatePath("/calendario");
    if (data.errors.length) return { ok: false, error: data.errors.join(" ") };
    return { ok: true, message: `Vista previa generada: ${data.summary.totalMatches} partidos.`, warnings: data.warnings.length ? data.warnings : undefined };
  });
}

export async function regenerateDraftAction(): Promise<ActionResult> {
  return runAction(async (user) => {
    const seasonId = await getSeasonId();
    if (!seasonId) throw new ActionError("No hay temporada seleccionada.");
    const draft = await getActiveDraft(seasonId);
    if (!draft) throw new ActionError("No hay un calendario provisional.");
    await createDraft(seasonId, { ...draft.params, seed: Math.floor(Math.random() * 1_000_000_000) }, user.id);
    revalidatePath("/calendario");
    return { ok: true, message: "Nueva propuesta generada." };
  });
}

export async function discardDraftAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await discardDraft(String(fd.get("draftId")));
    revalidatePath("/calendario");
    return { ok: true, message: "Calendario provisional descartado." };
  });
}

export async function confirmDraftAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    await confirmDraft(String(fd.get("draftId")), { acknowledgeIssues: isConfirm(fd) }, user.id);
    revalidatePath("/", "layout");
    return { ok: true, message: "Calendario confirmado y protegido contra cambios accidentales." };
  });
}

export async function setRoundLockAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const d = parseForm(z.object({ roundId: zs.id, locked: zs.bool, reason: zs.text(300, "El motivo") }), fd);
    await setRoundLock(d.roundId, d.locked, d.reason, user.id);
    revalidatePath("/calendario");
    return { ok: true, message: d.locked ? "Jornada protegida." : "Jornada desbloqueada: los cambios se registrarán en el historial." };
  });
}

export async function updateRoundDateAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const d = parseForm(z.object({ roundId: zs.id, date: zs.date, reason: zs.text(300, "El motivo") }), fd);
    await updateRoundDate(d.roundId, d.date, d.reason, user.id);
    revalidatePath("/calendario");
    return { ok: true, message: "Fecha de la jornada actualizada; sus partidos quedan como reprogramados." };
  });
}
