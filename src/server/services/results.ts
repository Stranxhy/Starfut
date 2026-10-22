import "server-only";
import { prisma } from "@/lib/prisma";
import { validateResult, type ResultInput } from "@/domain/scoring";
import { validateScorers } from "@/domain/scorers";
import { RESULT_TYPE } from "@/lib/labels";
import { ActionError } from "../errors";
import { audit } from "../audit";
import { getScoringRules } from "./rules";
import { onPlayoffResultChanged } from "./playoffs";

export interface ScorerInput {
  playerId: string;
  teamId: string;
  goals: number;
}

export interface SaveResultInput extends ResultInput {
  notes?: string | null;
  scorers: ScorerInput[];
  /** Motivo: obligatorio al corregir un resultado ya registrado. */
  reason?: string | null;
}

function describe(r: { resultType: string; homeGoals: number; awayGoals: number; homeShootout?: number | null; awayShootout?: number | null }) {
  const pen = r.homeShootout != null && r.awayShootout != null ? ` (penales ${r.homeShootout}-${r.awayShootout})` : "";
  return `${r.homeGoals}-${r.awayGoals}${pen} · ${RESULT_TYPE[r.resultType] ?? r.resultType}`;
}

/**
 * Registra o corrige el resultado de un partido en una sola transacción:
 * resultado + goleadores + estado del partido + historial. Guardar varias
 * veces el mismo resultado no duplica nada (un único resultado por partido y
 * las estadísticas se recalculan desde cero).
 */
export async function saveResult(matchId: string, input: SaveResultInput, userId: string) {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUniqueOrThrow({
      where: { id: matchId },
      include: { result: true, scorers: true, homeTeam: true, awayTeam: true, playoffTie: true },
    });
    if (match.status === "CANCELADO") throw new ActionError("No se puede registrar resultado de un partido cancelado.");
    if (match.status === "PENDIENTE" || !match.date) {
      throw new ActionError("El partido no está programado (sin fecha u horario). Prográmalo antes de registrar su resultado.");
    }
    const rules = await getScoringRules(match.seasonId, match.homeTeam.leagueId === match.awayTeam.leagueId ? match.leagueId : null, tx);
    if (match.stage !== "REGULAR" && input.resultType === "EMPATE") {
      throw new ActionError("En eliminatorias debe haber un ganador: registra el desempate.");
    }
    const v = validateResult(input, match.homeTeamId, match.awayTeamId, rules);
    if (!v.ok) throw new ActionError(v.errors[0], { warnings: v.errors.slice(1) });

    const scorerErrors = validateScorers(input.scorers, match.homeTeamId, match.awayTeamId, input.homeGoals, input.awayGoals);
    if (scorerErrors.length) throw new ActionError(scorerErrors[0], { warnings: scorerErrors.slice(1) });
    if (input.scorers.length) {
      const players = await tx.player.findMany({
        where: { id: { in: input.scorers.map((s) => s.playerId) } },
        include: { history: { select: { teamId: true } } },
      });
      for (const s of input.scorers) {
        const p = players.find((x) => x.id === s.playerId);
        if (!p) throw new ActionError("Un goleador seleccionado no existe.");
        const teams = new Set([p.teamId, ...p.history.map((h) => h.teamId)]);
        if (!teams.has(s.teamId)) throw new ActionError(`${p.fullName} no pertenece al equipo indicado.`);
      }
    }

    const previous = match.result;
    const isCorrection = !!previous;
    const changed =
      !previous ||
      previous.resultType !== v.value.resultType ||
      previous.homeGoals !== v.value.homeGoals ||
      previous.awayGoals !== v.value.awayGoals ||
      (previous.homeShootout ?? null) !== (v.value.homeShootout ?? null) ||
      (previous.awayShootout ?? null) !== (v.value.awayShootout ?? null) ||
      previous.winnerTeamId !== v.value.winnerTeamId;
    const scorersBefore = match.scorers.map((s) => `${s.playerId}:${s.teamId}:${s.goals}`).sort().join(",");
    const scorersAfter = input.scorers.map((s) => `${s.playerId}:${s.teamId}:${s.goals}`).sort().join(",");
    const scorersChanged = scorersBefore !== scorersAfter;

    if (isCorrection && (changed || scorersChanged) && !input.reason?.trim()) {
      throw new ActionError("Este partido ya tenía resultado oficial. Indica el motivo de la corrección.", {
        fieldErrors: { reason: "Motivo obligatorio para corregir un resultado." },
      });
    }
    if (isCorrection && !changed && !scorersChanged && (input.notes ?? null) === (previous.notes ?? null)) {
      return { unchanged: true };
    }
    if (input.resultType === "ADMINISTRATIVO" && !(input.reason?.trim() || input.notes?.trim())) {
      throw new ActionError("Una decisión administrativa requiere indicar la resolución oficial en observaciones o motivo.");
    }

    const data = {
      resultType: v.value.resultType,
      homeGoals: v.value.homeGoals,
      awayGoals: v.value.awayGoals,
      homeShootout: v.value.homeShootout ?? null,
      awayShootout: v.value.awayShootout ?? null,
      winnerTeamId: v.value.winnerTeamId,
      notes: input.notes || null,
    };
    await tx.matchResult.upsert({
      where: { matchId },
      create: { matchId, ...data, recordedById: userId },
      update: { ...data, updatedById: userId, version: { increment: 1 } },
    });
    if (scorersChanged) {
      await tx.matchScorer.deleteMany({ where: { matchId } });
      if (input.scorers.length) {
        await tx.matchScorer.createMany({ data: input.scorers.map((s) => ({ matchId, ...s })) });
      }
    }
    await tx.match.update({ where: { id: matchId }, data: { status: "JUGADO" } });

    if (match.playoffTie) {
      await onPlayoffResultChanged(tx, match.playoffTie.id, v.value.winnerTeamId, userId);
    }

    await audit(tx, {
      userId,
      action: isCorrection ? "CORRECCION_RESULTADO" : "RESULTADO",
      entity: "Partido",
      entityId: matchId,
      summary: `${match.homeTeam.name} vs ${match.awayTeam.name}: ${describe(data)}`,
      before: previous
        ? { resultado: describe(previous), goleadores: match.scorers.map((s) => ({ jugador: s.playerId, goles: s.goals })) }
        : undefined,
      after: { resultado: describe(data), goleadores: input.scorers.map((s) => ({ jugador: s.playerId, goles: s.goals })) },
      reason: input.reason,
    });
    return { unchanged: false };
  });
}

/** Elimina el resultado oficial (p. ej., capturado por error). El partido vuelve a programado. */
export async function revertResult(matchId: string, reason: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUniqueOrThrow({
      where: { id: matchId },
      include: { result: true, homeTeam: true, awayTeam: true, playoffTie: true, scorers: true },
    });
    if (!match.result) throw new ActionError("El partido no tiene resultado registrado.");
    if (match.playoffTie) await onPlayoffResultChanged(tx, match.playoffTie.id, null, userId);
    await tx.matchScorer.deleteMany({ where: { matchId } });
    await tx.matchResult.delete({ where: { matchId } });
    await tx.match.update({
      where: { id: matchId },
      data: { status: match.rescheduleCount > 0 ? "REPROGRAMADO" : "PROGRAMADO" },
    });
    await audit(tx, {
      userId,
      action: "REVERTIR_RESULTADO",
      entity: "Partido",
      entityId: matchId,
      summary: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
      before: { resultado: describe(match.result), goleadores: match.scorers.length },
      reason,
    });
  });
}
