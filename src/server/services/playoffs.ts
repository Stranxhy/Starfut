import "server-only";
import { prisma, type Tx } from "@/lib/prisma";
import { fromISODate, toISODate } from "@/lib/dates";
import { applyManualOrder, type StandingRow } from "@/domain/standings";
import { parseSource, resolveSource, validateBracket, type StageOutcome } from "@/domain/bracket";
import { ActionError } from "../errors";
import { audit } from "../audit";
import { getPlayoffFormat } from "./rules";
import { getLeagueStandings } from "./standings";
import { MATCH_INCLUDE, sortMatches } from "./matches";

const SNAPSHOT_KIND = "CIERRE_FASE_REGULAR";

/** Revisión previa al cierre de la fase regular de una liga. */
export async function getClosureReview(leagueId: string) {
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId }, include: { season: true } });
  const [rounds, pending, cancelled, standings, snapshot] = await Promise.all([
    prisma.round.findMany({ where: { seasonId: league.seasonId, phase: "REGULAR" }, orderBy: { number: "asc" } }),
    prisma.match.findMany({
      where: { leagueId, stage: "REGULAR", countsForStandings: true, status: { notIn: ["JUGADO", "CANCELADO"] } },
      include: MATCH_INCLUDE,
    }),
    prisma.match.findMany({
      where: { leagueId, stage: "REGULAR", status: "CANCELADO", type: { in: ["OFICIAL", "SUSTITUCION"] } },
      include: { ...MATCH_INCLUDE, replacements: { select: { id: true, status: true } } },
    }),
    getLeagueStandings(leagueId),
    prisma.standingSnapshot.findUnique({ where: { leagueId_kind: { leagueId, kind: SNAPSHOT_KIND } } }),
  ]);
  const { bracket, officialConfirmed } = await getPlayoffFormat(leagueId, standings.rows.length);
  const bracketErrors = validateBracket(bracket, standings.rows.length);
  const seedPositions = new Set(
    bracket.stages.flatMap((s) => s.ties.flatMap((t) => [t.home, t.away])).map(parseSource).filter((p) => p?.kind === "seed").map((p) => (p as { position: number }).position),
  );
  // Un empate sin resolver importa si involucra posiciones que clasifican o la frontera de clasificación.
  const maxSeed = seedPositions.size ? Math.max(...seedPositions) : 0;
  const relevantGroups = standings.unresolvedGroups
    .map((g, index) => ({ index, teamIds: g, positions: standings.rows.filter((r) => g.includes(r.teamId)).map((r) => r.position) }))
    .filter((g) => g.teamIds.length > 1 && g.positions.some((p) => p <= maxSeed));
  const roundsWithMatches = new Set(
    (await prisma.match.findMany({ where: { leagueId, stage: "REGULAR" }, select: { round: { select: { number: true } } } }))
      .map((m) => m.round?.number)
      .filter(Boolean),
  );
  const missingRounds: number[] = [];
  for (let i = 1; i <= league.season.regularRounds; i++) if (!roundsWithMatches.has(i)) missingRounds.push(i);
  return {
    league,
    roundsConfigured: league.season.regularRounds,
    roundsInCalendar: rounds.length,
    missingRounds,
    pending: sortMatches(pending),
    cancelledWithoutReplacement: cancelled.filter((c) => c.replacements.every((r) => r.status === "CANCELADO")),
    standings,
    bracket,
    bracketErrors,
    officialConfirmed,
    relevantGroups,
    closed: !!snapshot,
    snapshot,
  };
}

export async function closeRegularPhase(
  leagueId: string,
  opts: { acceptPending: boolean; manualOrders: Record<string, string[]>; notes?: string | null },
  userId: string,
) {
  const review = await getClosureReview(leagueId);
  if (review.closed) throw new ActionError("La fase regular de esta liga ya está cerrada.");
  if (review.bracketErrors.length) {
    throw new ActionError("El cuadro de eliminatorias no es válido para esta liga. Corrígelo en Configuración.", {
      warnings: review.bracketErrors,
    });
  }
  const issues: string[] = [];
  if (review.missingRounds.length) issues.push(`Jornadas sin partidos en el calendario: ${review.missingRounds.join(", ")}.`);
  if (review.pending.length) issues.push(`${review.pending.length} partido(s) oficiales sin resultado.`);
  if (review.cancelledWithoutReplacement.length)
    issues.push(`${review.cancelledWithoutReplacement.length} partido(s) cancelados sin reprogramar.`);
  if (issues.length && !opts.acceptPending) {
    throw new ActionError("La clasificación está incompleta. Confirma explícitamente que deseas cerrar así.", {
      warnings: issues,
      needsConfirmation: true,
    });
  }
  let result = { rows: review.standings.rows as StandingRow[], unresolvedGroups: review.standings.unresolvedGroups };
  const decisions: string[] = [];
  for (const g of review.relevantGroups) {
    const order = opts.manualOrders[String(g.index)];
    if (!order) {
      throw new ActionError(
        "Hay equipos empatados que los criterios configurados no resuelven y que afectan la clasificación. Indica el orden oficial.",
        { warnings: [`Empate entre posiciones ${g.positions.join(", ")}`] },
      );
    }
    result = applyManualOrder(result, g.index, order);
    decisions.push(`Orden oficial para posiciones ${g.positions.join(", ")}`);
  }
  if (decisions.length && !opts.notes?.trim()) {
    throw new ActionError("Indica en observaciones la decisión oficial que resolvió el empate.", {
      fieldErrors: { notes: "Obligatorio cuando hay desempate manual." },
    });
  }
  const rows = result.rows.map((r) => ({ ...r, unresolvedTieGroup: null, zone: undefined }));
  const seeds = rows.map((r) => r.teamId);

  await prisma.$transaction(async (tx) => {
    await tx.standingSnapshot.create({
      data: {
        seasonId: review.league.seasonId,
        leagueId,
        kind: SNAPSHOT_KIND,
        rows: JSON.parse(JSON.stringify(rows)),
        notes: [opts.notes, ...issues.map((i) => `Cerrada con advertencia: ${i}`)].filter(Boolean).join("\n") || null,
        createdById: userId,
      },
    });
    for (const [order, stage] of review.bracket.stages.entries()) {
      const created = await tx.playoffStage.create({
        data: { seasonId: review.league.seasonId, leagueId, code: stage.code, name: stage.name, order: order + 1 },
      });
      for (const [i, tie] of stage.ties.entries()) {
        await tx.playoffTie.create({
          data: {
            stageId: created.id,
            slot: i + 1,
            homeSource: tie.home.toUpperCase(),
            awaySource: tie.away.toUpperCase(),
            homeTeamId: resolveSource(tie.home, seeds, {}),
            awayTeamId: resolveSource(tie.away, seeds, {}),
          },
        });
      }
    }
    await audit(tx, {
      userId,
      action: "CIERRE_FASE_REGULAR",
      entity: "Liga",
      entityId: leagueId,
      summary: `Cierre de fase regular: ${review.league.name}`,
      after: { clasificacion: rows.map((r) => `${r.position}. ${r.teamName} (${r.pts})`), decisiones: decisions },
      reason: opts.notes,
    });
    const open = await tx.league.count({
      where: { seasonId: review.league.seasonId, active: true, standingSnapshots: { none: { kind: SNAPSHOT_KIND } } },
    });
    if (open === 0) {
      await tx.season.update({ where: { id: review.league.seasonId }, data: { status: "FASE_REGULAR_CERRADA" } });
    }
  });
}

export async function reopenRegularPhase(leagueId: string, reason: string, userId: string) {
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const playoffMatches = await prisma.match.count({ where: { leagueId, stage: { not: "REGULAR" } } });
  if (playoffMatches > 0) {
    throw new ActionError("Ya existen partidos de eliminatoria. Elimina o revierte primero esos partidos para reabrir la fase regular.");
  }
  await prisma.$transaction(async (tx) => {
    const snap = await tx.standingSnapshot.findUnique({ where: { leagueId_kind: { leagueId, kind: SNAPSHOT_KIND } } });
    await tx.playoffStage.deleteMany({ where: { leagueId } });
    await tx.standingSnapshot.deleteMany({ where: { leagueId, kind: SNAPSHOT_KIND } });
    await tx.league.update({ where: { id: leagueId }, data: { championTeamId: null } });
    await tx.season.update({ where: { id: league.seasonId }, data: { status: "EN_CURSO" } });
    await audit(tx, {
      userId,
      action: "ELIMINATORIA",
      entity: "Liga",
      entityId: leagueId,
      summary: `Fase regular reabierta: ${league.name}`,
      before: snap ? { clasificacionCongelada: snap.rows } : undefined,
      reason,
    });
  });
}

async function outcomesFor(leagueId: string, db: Tx): Promise<Record<string, StageOutcome>> {
  const stages = await db.playoffStage.findMany({
    where: { leagueId },
    include: { ties: { orderBy: { slot: "asc" } } },
  });
  const out: Record<string, StageOutcome> = {};
  for (const s of stages) {
    out[s.code] = {
      winners: s.ties.map((t) => t.winnerTeamId),
      losers: s.ties.map((t) =>
        t.winnerTeamId ? (t.winnerTeamId === t.homeTeamId ? t.awayTeamId : t.homeTeamId) : null,
      ),
    };
  }
  return out;
}

/** Actualiza participantes de cruces cuyos orígenes ya se conocen. */
async function refreshParticipants(leagueId: string, db: Tx) {
  const snap = await db.standingSnapshot.findUnique({ where: { leagueId_kind: { leagueId, kind: SNAPSHOT_KIND } } });
  if (!snap) return;
  const seeds = (snap.rows as unknown as StandingRow[]).map((r) => r.teamId);
  const outcomes = await outcomesFor(leagueId, db);
  const ties = await db.playoffTie.findMany({ where: { stage: { leagueId } }, include: { match: { include: { result: true } } } });
  for (const t of ties) {
    const home = resolveSource(t.homeSource, seeds, outcomes);
    const away = resolveSource(t.awaySource, seeds, outcomes);
    if (home === t.homeTeamId && away === t.awayTeamId) continue;
    if (t.match?.result) {
      throw new ActionError(
        "El cambio afecta a un cruce posterior que ya tiene resultado. Revierte primero el resultado de la ronda siguiente.",
      );
    }
    await db.playoffTie.update({ where: { id: t.id }, data: { homeTeamId: home, awayTeamId: away } });
    if (t.match) {
      if (home && away) {
        await db.match.update({ where: { id: t.match.id }, data: { homeTeamId: home, awayTeamId: away } });
      } else {
        // El participante dejó de conocerse: el partido programado se elimina (aún no se disputa).
        await db.playoffTie.update({ where: { id: t.id }, data: { matchId: null } });
        await db.match.delete({ where: { id: t.match.id } });
        await db.playoffStage.update({ where: { id: t.stageId }, data: { status: "PENDIENTE" } });
      }
    }
  }
}

/** Se ejecuta dentro de la transacción del resultado de un partido de eliminatoria. */
export async function onPlayoffResultChanged(tx: Tx, tieId: string, winnerId: string | null, userId: string) {
  const tie = await tx.playoffTie.findUniqueOrThrow({ where: { id: tieId }, include: { stage: true } });
  if (tie.winnerTeamId === winnerId) return;
  await tx.playoffTie.update({ where: { id: tieId }, data: { winnerTeamId: winnerId } });
  await refreshParticipants(tie.stage.leagueId, tx);
  const stageTies = await tx.playoffTie.findMany({ where: { stageId: tie.stageId } });
  const complete = stageTies.every((t) => t.winnerTeamId);
  await tx.playoffStage.update({
    where: { id: tie.stageId },
    data: { status: complete ? "COMPLETADA" : "GENERADA" },
  });
  const stages = await tx.playoffStage.findMany({ where: { leagueId: tie.stage.leagueId }, orderBy: { order: "asc" } });
  const finalStage = stages.find((s) => s.code === "FINAL") ?? stages.filter((s) => s.code !== "TERCER_LUGAR").at(-1);
  if (finalStage?.id === tie.stageId) {
    await tx.league.update({ where: { id: tie.stage.leagueId }, data: { championTeamId: complete ? winnerId : null } });
    const league = await tx.league.findUniqueOrThrow({ where: { id: tie.stage.leagueId }, include: { championTeam: true } });
    await audit(tx, {
      userId,
      action: "ELIMINATORIA",
      entity: "Liga",
      entityId: league.id,
      summary: winnerId ? `Campeón registrado: ${league.championTeam?.name}` : "Campeón retirado (resultado revertido)",
    });
  }
}

export async function getBracketView(leagueId: string) {
  const [stages, snap, league] = await Promise.all([
    prisma.playoffStage.findMany({
      where: { leagueId },
      orderBy: { order: "asc" },
      include: {
        ties: {
          orderBy: { slot: "asc" },
          include: {
            homeTeam: { select: { id: true, name: true } },
            awayTeam: { select: { id: true, name: true } },
            winnerTeam: { select: { id: true, name: true } },
            match: { include: MATCH_INCLUDE },
          },
        },
      },
    }),
    prisma.standingSnapshot.findUnique({ where: { leagueId_kind: { leagueId, kind: SNAPSHOT_KIND } } }),
    prisma.league.findUniqueOrThrow({ where: { id: leagueId }, include: { championTeam: true, season: true } }),
  ]);
  const seeds = snap ? (snap.rows as unknown as StandingRow[]) : [];
  const seedOf = new Map(seeds.map((r) => [r.teamId, r.position]));
  const stageNames = Object.fromEntries(stages.map((s) => [s.code, s.name]));
  return { league, stages, snapshot: snap, seedOf, stageNames };
}

/** Siguiente fecha de juego sugerida para una etapa. */
export async function suggestStageDate(leagueId: string, stageId: string): Promise<string> {
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId }, include: { season: true } });
  const stage = await prisma.playoffStage.findUniqueOrThrow({ where: { id: stageId } });
  const last = await prisma.match.aggregate({
    where: {
      leagueId,
      OR: [{ stage: "REGULAR" }, { playoffTie: { stage: { order: { lt: stage.order } } } }],
      date: { not: null },
    },
    _max: { date: true },
  });
  const base = last._max.date ?? new Date();
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + 1));
  while (d.getUTCDay() !== league.season.weekday) d.setUTCDate(d.getUTCDate() + 1);
  return toISODate(d)!;
}

/** Genera los partidos de una etapa cuando todos sus participantes se conocen. */
export async function generateStageMatches(stageId: string, date: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const stage = await tx.playoffStage.findUniqueOrThrow({
      where: { id: stageId },
      include: { ties: { orderBy: { slot: "asc" }, include: { homeTeam: true, awayTeam: true } }, league: true },
    });
    await refreshParticipants(stage.leagueId, tx);
    const ties = await tx.playoffTie.findMany({ where: { stageId }, orderBy: { slot: "asc" }, include: { homeTeam: true, awayTeam: true } });
    if (ties.some((t) => !t.homeTeamId || !t.awayTeamId)) {
      throw new ActionError(`Todavía no se conocen todos los participantes de ${stage.name}. Registra los resultados de la ronda anterior.`);
    }
    if (ties.some((t) => t.matchId)) throw new ActionError(`Los partidos de ${stage.name} ya fueron generados.`);

    const season = await tx.season.findUniqueOrThrow({
      where: { id: stage.seasonId },
      include: {
        timeSlots: { where: { active: true }, orderBy: { startTime: "asc" } },
        venue: { include: { fields: { where: { active: true }, orderBy: { sortOrder: "asc" } } } },
      },
    });
    const d = fromISODate(date);
    const [busy, blocks] = await Promise.all([
      tx.match.findMany({ where: { seasonId: stage.seasonId, date: d, status: { not: "CANCELADO" } } }),
      tx.fieldBlock.findMany({ where: { date: d } }),
    ]);
    const teamBusy = new Set(busy.flatMap((m) => [`${m.timeSlotId}|${m.homeTeamId}`, `${m.timeSlotId}|${m.awayTeamId}`]));

    const round = await tx.round.upsert({
      where: { seasonId_phase_number: { seasonId: stage.seasonId, phase: "ELIMINATORIA", number: stage.order } },
      create: { seasonId: stage.seasonId, phase: "ELIMINATORIA", number: stage.order, name: stage.name, date: d },
      update: { date: d, name: stage.name },
    });

    const warnings: string[] = [];
    // Reparte los cruces en horarios distintos cuando es posible.
    const slotQueue: { tsId: string; fieldId: string }[] = [];
    for (let fi = 0; fi < season.venue.fields.length; fi++) {
      for (const ts of season.timeSlots) {
        const f = season.venue.fields[fi];
        if (busy.some((m) => m.timeSlotId === ts.id && m.fieldId === f.id)) continue;
        if (blocks.some((b) => b.fieldId === f.id && (b.timeSlotId === null || b.timeSlotId === ts.id))) continue;
        slotQueue.push({ tsId: ts.id, fieldId: f.id });
      }
    }
    for (const tie of ties) {
      const idx = slotQueue.findIndex((s) => !teamBusy.has(`${s.tsId}|${tie.homeTeamId}`) && !teamBusy.has(`${s.tsId}|${tie.awayTeamId}`));
      const slot = idx >= 0 ? slotQueue.splice(idx, 1)[0] : null;
      if (!slot) warnings.push(`${tie.homeTeam!.name} vs ${tie.awayTeam!.name}: sin espacio disponible; queda pendiente de programar.`);
      const match = await tx.match.create({
        data: {
          seasonId: stage.seasonId,
          leagueId: stage.leagueId,
          roundId: round.id,
          stage: stage.code,
          type: "ELIMINATORIA",
          countsForStandings: false,
          status: slot ? "PROGRAMADO" : "PENDIENTE",
          date: d,
          timeSlotId: slot?.tsId ?? null,
          fieldId: slot?.fieldId ?? null,
          homeTeamId: tie.homeTeamId!,
          awayTeamId: tie.awayTeamId!,
        },
      });
      if (slot) {
        teamBusy.add(`${slot.tsId}|${tie.homeTeamId}`);
        teamBusy.add(`${slot.tsId}|${tie.awayTeamId}`);
      }
      await tx.playoffTie.update({ where: { id: tie.id }, data: { matchId: match.id } });
    }
    await tx.playoffStage.update({ where: { id: stageId }, data: { status: "GENERADA" } });
    await audit(tx, {
      userId,
      action: "ELIMINATORIA",
      entity: "Liga",
      entityId: stage.leagueId,
      summary: `${stage.name} generada (${stage.league.name}) para el ${date}`,
      after: { cruces: ties.map((t) => `${t.homeTeam!.name} vs ${t.awayTeam!.name}`), advertencias: warnings },
    });
    return { warnings };
  });
}
