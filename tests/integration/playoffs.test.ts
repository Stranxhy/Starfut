import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { closeRegularPhase, generateStageMatches, getClosureReview, reopenRegularPhase } from "@/server/services/playoffs";
import { revertResult, saveResult } from "@/server/services/results";
import { getLeagueStandings } from "@/server/services/standings";
import { createMatch, updateMatch } from "@/server/services/matches";
import { createFixture, quickMatch, type Fixture } from "../support/fixtures";

let f: Fixture;
let ranking: string[];

/** Liga de 12 equipos: el equipo i vence a todos los de índice mayor (orden de tabla determinista). */
beforeAll(async () => {
  f = await createFixture({ teamsA: 12, teamsB: 2, referees: 6 });
  const teams = f.teamsA;
  let day = 0;
  const pending: { home: string; away: string }[] = [];
  for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) pending.push({ home: teams[i].id, away: teams[j].id });
  // 66 partidos: 6 por fecha en horarios distintos → 11 jornadas
  await prisma.season.update({ where: { id: f.season.id }, data: { regularRounds: 11 } });
  let roundId = "";
  for (let k = 0; k < pending.length; k++) {
    const date = new Date(Date.UTC(2026, 6, 5 + (Math.floor(k / 6) + 1) * 7)).toISOString().slice(0, 10);
    if (k % 6 === 0) {
      day++;
      roundId = (await prisma.round.create({ data: { seasonId: f.season.id, number: day, date: new Date(`${date}T00:00:00Z`) } })).id;
    }
    const m = await quickMatch(f, pending[k].home, pending[k].away, date, k % 6, 0);
    await prisma.match.update({ where: { id: m.id }, data: { roundId } });
    await saveResult(m.id, { resultType: "TIEMPO_REGULAR", homeGoals: 2, awayGoals: 0, scorers: [] }, f.userId);
  }
  ranking = teams.map((t) => t.id);
});

const playTie = async (stageCode: string, homeWins = true) => {
  const stage = await prisma.playoffStage.findFirstOrThrow({ where: { leagueId: f.leagues[0].id, code: stageCode }, include: { ties: { include: { match: true } } } });
  for (const t of stage.ties) {
    await saveResult(t.match!.id, homeWins ? { resultType: "TIEMPO_REGULAR", homeGoals: 1, awayGoals: 0, scorers: [] } : { resultType: "DESEMPATE", homeGoals: 1, awayGoals: 1, homeShootout: 2, awayShootout: 3, scorers: [] }, f.userId);
  }
};

describe("eliminatorias (base de datos)", () => {
  it("la tabla final ordena según los resultados", async () => {
    const s = await getLeagueStandings(f.leagues[0].id);
    expect(s.rows.map((r) => r.teamId)).toEqual(ranking);
    expect(s.rows[0].zone?.positions).toEqual([1, 2, 3, 4]);
  });

  it("detecta partidos pendientes y exige autorización explícita para cerrar", async () => {
    const pendingMatch = await quickMatch(f, f.teamsA[0].id, f.teamsA[1].id, "2026-12-20", 0, 1);
    const review = await getClosureReview(f.leagues[0].id);
    expect(review.pending.map((m) => m.id)).toContain(pendingMatch.id);
    await expect(closeRegularPhase(f.leagues[0].id, { acceptPending: false, manualOrders: {} }, f.userId)).rejects.toMatchObject({ extra: { needsConfirmation: true } });
    expect(await prisma.standingSnapshot.count({ where: { leagueId: f.leagues[0].id } })).toBe(0);
    await prisma.match.delete({ where: { id: pendingMatch.id } });
  });

  it("cierra la fase regular, congela la clasificación y genera el repechaje 5-12, 6-11, 7-10, 8-9", async () => {
    await closeRegularPhase(f.leagues[0].id, { acceptPending: false, manualOrders: {} }, f.userId);
    const snap = await prisma.standingSnapshot.findFirstOrThrow({ where: { leagueId: f.leagues[0].id } });
    expect((snap.rows as { teamId: string }[]).map((r) => r.teamId)).toEqual(ranking);
    const rep = await prisma.playoffStage.findFirstOrThrow({ where: { leagueId: f.leagues[0].id, code: "REPECHAJE" }, include: { ties: { orderBy: { slot: "asc" } } } });
    expect(rep.ties.map((t) => [t.homeTeamId, t.awayTeamId])).toEqual([
      [ranking[4], ranking[11]],
      [ranking[5], ranking[10]],
      [ranking[6], ranking[9]],
      [ranking[7], ranking[8]],
    ]);
    const cuartos = await prisma.playoffStage.findFirstOrThrow({ where: { leagueId: f.leagues[0].id, code: "CUARTOS" }, include: { ties: { orderBy: { slot: "asc" } } } });
    expect(cuartos.ties.map((t) => t.homeTeamId)).toEqual(ranking.slice(0, 4));
    expect(cuartos.ties.every((t) => t.awayTeamId === null)).toBe(true);
  });

  it("con la fase regular cerrada, los demás partidos del día son amistosos y no cuentan", async () => {
    const before = await getLeagueStandings(f.leagues[0].id);
    const { match, warnings } = await createMatch(
      f.season.id,
      { type: "OFICIAL", homeTeamId: ranking[0], awayTeamId: ranking[1], date: "2027-01-03", timeSlotId: f.timeSlots[5].id, fieldId: f.fields[4].id, refereeId: null },
      { confirm: true, userId: f.userId },
    );
    expect(match.type).toBe("AMISTOSO");
    expect(match.countsForStandings).toBe(false);
    expect(warnings.join(" ")).toMatch(/amistoso/);
    await saveResult(match.id, { resultType: "TIEMPO_REGULAR", homeGoals: 0, awayGoals: 3, scorers: [] }, f.userId);
    const after = await getLeagueStandings(f.leagues[0].id);
    expect(after.rows.map((r) => [r.teamId, r.pts])).toEqual(before.rows.map((r) => [r.teamId, r.pts]));
    await expect(updateMatch(match.id, { type: "OFICIAL" }, { confirm: true, userId: f.userId })).rejects.toThrow();
  });

  it("no genera una ronda si no se conocen todos los participantes", async () => {
    const cuartos = await prisma.playoffStage.findFirstOrThrow({ where: { leagueId: f.leagues[0].id, code: "CUARTOS" } });
    await expect(generateStageMatches(cuartos.id, "2027-01-10", f.userId)).rejects.toThrow(/participantes/);
  });

  it("flujo completo: repechaje → cuartos → semifinal → final → campeón", async () => {
    const lid = f.leagues[0].id;
    const stage = (code: string) => prisma.playoffStage.findFirstOrThrow({ where: { leagueId: lid, code } });
    await generateStageMatches((await stage("REPECHAJE")).id, "2027-01-03", f.userId);
    // Visitantes ganan por penales en repechaje: avanzan 12, 11, 10, 9
    await playTie("REPECHAJE", false);
    const cuartos = await prisma.playoffStage.findFirstOrThrow({ where: { leagueId: lid, code: "CUARTOS" }, include: { ties: { orderBy: { slot: "asc" } } } });
    expect(cuartos.ties.map((t) => t.awayTeamId)).toEqual([ranking[8], ranking[9], ranking[10], ranking[11]]);
    await generateStageMatches(cuartos.id, "2027-01-10", f.userId);
    await playTie("CUARTOS", true);
    await generateStageMatches((await stage("SEMIFINAL")).id, "2027-01-17", f.userId);

    // Corrección controlada: revertir un resultado de cuartos actualiza la semifinal aún no jugada
    const q1 = await prisma.playoffTie.findFirstOrThrow({ where: { stage: { leagueId: lid, code: "CUARTOS" }, slot: 1 }, include: { match: true } });
    await saveResult(q1.match!.id, { resultType: "TIEMPO_REGULAR", homeGoals: 0, awayGoals: 1, scorers: [], reason: "Corrección de acta" }, f.userId);
    const semi1 = await prisma.playoffTie.findFirstOrThrow({ where: { stage: { leagueId: lid, code: "SEMIFINAL" }, slot: 1 }, include: { match: true } });
    expect(semi1.homeTeamId).toBe(ranking[8]);
    expect(semi1.match?.homeTeamId).toBe(ranking[8]);

    await playTie("SEMIFINAL", true);
    // Un cambio que afecta una ronda ya disputada se bloquea
    await expect(revertResult(q1.match!.id, "intento", f.userId)).rejects.toThrow(/ya tiene resultado/);

    await generateStageMatches((await stage("FINAL")).id, "2027-01-24", f.userId);
    await playTie("FINAL", true);
    const league = await prisma.league.findUniqueOrThrow({ where: { id: lid } });
    expect(league.championTeamId).toBe(ranking[8]);
    expect(await prisma.auditLog.count({ where: { entityId: lid, action: "ELIMINATORIA" } })).toBeGreaterThanOrEqual(5);
    // La clasificación congelada se conserva
    expect(await prisma.standingSnapshot.count({ where: { leagueId: lid } })).toBe(1);
  });

  it("no permite reabrir la fase regular si ya hay partidos de eliminatoria", async () => {
    await expect(reopenRegularPhase(f.leagues[0].id, "prueba", f.userId)).rejects.toThrow(/eliminatoria/);
  });
});
