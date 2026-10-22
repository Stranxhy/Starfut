"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "../action";
import { isConfirm, parseForm, zs } from "../validation";
import { closeRegularPhase, generateStageMatches, reopenRegularPhase } from "../services/playoffs";

export async function closeRegularPhaseAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const leagueId = String(fd.get("leagueId"));
    const manualOrders: Record<string, string[]> = {};
    for (const [k, v] of fd.entries()) {
      const m = /^order\[(\d+)\]\[(\d+)\]$/.exec(k);
      if (m && typeof v === "string" && v) {
        (manualOrders[m[1]] ??= [])[Number(m[2])] = v;
      }
    }
    for (const [g, order] of Object.entries(manualOrders)) {
      if (new Set(order).size !== order.length || order.some((x) => !x)) {
        return { ok: false, error: `El orden manual del grupo ${Number(g) + 1} tiene equipos repetidos o vacíos.` };
      }
    }
    await closeRegularPhase(
      leagueId,
      { acceptPending: isConfirm(fd) || fd.get("acceptPending") === "1", manualOrders, notes: (fd.get("notes") as string) || null },
      user.id,
    );
    revalidatePath("/", "layout");
    return { ok: true, message: "Fase regular cerrada. Clasificación congelada y cuadro de eliminatorias creado." };
  });
}

export async function reopenRegularPhaseAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const d = parseForm(z.object({ leagueId: zs.id, reason: zs.text(300, "El motivo") }), fd);
    await reopenRegularPhase(d.leagueId, d.reason, user.id);
    revalidatePath("/", "layout");
    return { ok: true, message: "Fase regular reabierta." };
  });
}

export async function generateStageAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const d = parseForm(z.object({ stageId: zs.id, date: zs.date }), fd);
    const { warnings } = await generateStageMatches(d.stageId, d.date, user.id);
    revalidatePath("/eliminatorias");
    return { ok: true, message: "Partidos de la ronda generados. Revisa horarios y árbitros.", warnings: warnings.length ? warnings : undefined };
  });
}
