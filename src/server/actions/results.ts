"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ActionError, runAction, type ActionResult } from "../action";
import { parseForm, zs } from "../validation";
import { revertResult, saveResult } from "../services/results";

const schema = z.object({
  matchId: zs.id,
  resultType: z.enum(["TIEMPO_REGULAR", "DESEMPATE", "EMPATE", "ADMINISTRATIVO"]),
  homeGoals: zs.int(0, 99, "Los goles del local"),
  awayGoals: zs.int(0, 99, "Los goles del visitante"),
  homeShootout: zs.optInt(0, 99),
  awayShootout: zs.optInt(0, 99),
  winnerTeamId: zs.optId,
  notes: zs.optText(500),
  reason: zs.optText(300),
  scorers: z.string().optional(),
  keepScorers: zs.bool.optional(),
});

const scorerSchema = z.array(z.object({ playerId: z.string().min(1), teamId: z.string().min(1), goals: z.coerce.number().int().min(1).max(99) }));

export async function saveResultAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const d = parseForm(schema, fd);
    let scorers: z.infer<typeof scorerSchema> = [];
    if (d.keepScorers) {
      scorers = (await prisma.matchScorer.findMany({ where: { matchId: d.matchId } })).map((s) => ({ playerId: s.playerId, teamId: s.teamId, goals: s.goals }));
    } else if (d.scorers) {
      let raw: unknown;
      try {
        raw = JSON.parse(d.scorers);
      } catch {
        throw new ActionError("Lista de goleadores inválida.");
      }
      const parsed = scorerSchema.safeParse(raw);
      if (!parsed.success) throw new ActionError("Revisa los goleadores: selecciona jugador y goles (mínimo 1).");
      scorers = parsed.data.filter((s) => s.playerId);
    }
    const r = await saveResult(
      d.matchId,
      {
        resultType: d.resultType,
        homeGoals: d.homeGoals,
        awayGoals: d.awayGoals,
        homeShootout: d.homeShootout ?? null,
        awayShootout: d.awayShootout ?? null,
        winnerTeamId: d.winnerTeamId ?? null,
        notes: d.notes ?? null,
        reason: d.reason ?? null,
        scorers,
      },
      user.id,
    );
    revalidatePath("/", "layout");
    return { ok: true, message: r.unchanged ? "Sin cambios: el resultado ya estaba registrado así." : "Resultado guardado. Tabla y goleo actualizados." };
  }, "results");
}

export async function revertResultAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const d = parseForm(z.object({ matchId: zs.id, reason: zs.text(300, "El motivo") }), fd);
    await revertResult(d.matchId, d.reason, user.id);
    revalidatePath("/", "layout");
    return { ok: true, message: "Resultado revertido. Las estadísticas se recalcularon." };
  }, "results");
}
