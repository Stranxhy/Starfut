import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolveScorersPeriod, scorersPdfHref } from "@/domain/scorers-view";
import { loadScorers } from "@/pdf/data";
import { getLeagueScorers } from "@/server/services/standings";
import { saveResult } from "@/server/services/results";
import { createFixture, quickMatch, type Fixture } from "../support/fixtures";

let f: Fixture;
beforeAll(async () => {
  f = await createFixture({ teamsA: 2, teamsB: 0 });
  const [a, b] = f.teamsA;
  await prisma.tiebreakConfig.create({ data: {
    seasonId: f.season.id, leagueId: f.leagues[0].id,
    criteria: ["PUNTOS", "DIFERENCIA_GOLES"], scorerCriteria: ["EQUIPO_MEJOR_CLASIFICADO"],
  } });
  const first = await quickMatch(f, a.id, b.id, "2026-08-02");
  const second = await quickMatch(f, a.id, b.id, "2026-08-09");
  for (const [number, match] of [[1, first], [2, second]] as const) {
    const round = await prisma.round.create({ data: { seasonId: f.season.id, number, date: match.date! } });
    await prisma.match.update({ where: { id: match.id }, data: { roundId: round.id } });
  }
  await saveResult(first.id, { resultType: "TIEMPO_REGULAR", homeGoals: 2, awayGoals: 1, scorers: [
    { playerId: a.players[0].id, teamId: a.id, goals: 1 },
    { playerId: b.players[0].id, teamId: b.id, goals: 1 },
  ] }, f.userId);
  // Cambia la clasificación de equipos, pero no agrega goles individuales.
  await saveResult(second.id, { resultType: "TIEMPO_REGULAR", homeGoals: 0, awayGoals: 3, scorers: [] }, f.userId);
  const friendly = await quickMatch(f, a.id, b.id, "2026-08-16", 0, 0, { type: "AMISTOSO", countsForStandings: false });
  await saveResult(friendly.id, { resultType: "TIEMPO_REGULAR", homeGoals: 5, awayGoals: 0, scorers: [{ playerId: a.players[0].id, teamId: a.id, goals: 5 }] }, f.userId);
  const playoff = await quickMatch(f, a.id, b.id, "2026-08-23");
  const playoffRound = await prisma.round.create({ data: { seasonId: f.season.id, phase: "ELIMINATORIA", number: 99, date: playoff.date! } });
  await prisma.match.update({ where: { id: playoff.id }, data: { type: "ELIMINATORIA", stage: "FINAL", roundId: playoffRound.id, countsForStandings: false } });
  await saveResult(playoff.id, { resultType: "TIEMPO_REGULAR", homeGoals: 3, awayGoals: 0, scorers: [{ playerId: a.players[0].id, teamId: a.id, goals: 3 }] }, f.userId);
});

async function selected(periodo: string) {
  const selection = resolveScorersPeriod({ periodo }, [1, 2]);
  const web = await getLeagueScorers(f.leagues[0].id, { upToRound: selection.round, includePlayoffs: selection.includePlayoffs });
  const query = new URLSearchParams(scorersPdfHref(f.leagues[0].id, selection).split("?")[1]);
  const pdf = await loadScorers(f.season.id, query);
  expect(pdf.rows).toEqual(web.rows);
  return { web, pdf };
}

describe("clasificación y exportación de goleadores", () => {
  it("la fase regular excluye amistosos y eliminatorias", async () => {
    const { web, pdf } = await selected("regular");
    expect(web.rows.map((row) => [row.playerId, row.goals, row.matchesWithGoal])).toEqual([
      [f.teamsA[1].players[0].id, 1, 1], [f.teamsA[0].players[0].id, 1, 1],
    ]);
    expect(pdf.includePlayoffs).toBe(false);
  });
  it("el desempate histórico usa la clasificación de equipos hasta esa jornada", async () => {
    const { web, pdf } = await selected("jornada-1");
    expect(web.rows[0].playerId).toBe(f.teamsA[0].players[0].id);
    expect(web.rows[0]).toMatchObject({ position: 1, shared: false, goals: 1 });
    expect(pdf.caption).toBe("Hasta la jornada 1");
  });
  it("incluye eliminatorias tanto en pantalla como en el PDF sin confundir su número con una jornada regular", async () => {
    const { web, pdf } = await selected("completa");
    expect(web.rows[0]).toMatchObject({ playerId: f.teamsA[0].players[0].id, goals: 4, matchesWithGoal: 2 });
    expect(web.throughRound).toBe(1);
    expect(pdf.includePlayoffs).toBe(true);
    expect(pdf.caption).toBe("Fase regular + eliminatorias");
  });
  it("un PDF solicitado con jornada y eliminatorias describe correctamente el corte regular", async () => {
    const pdf = await loadScorers(f.season.id, new URLSearchParams({ league: f.leagues[0].id, round: "1", playoffs: "1" }));
    expect(pdf.includePlayoffs).toBe(false);
    expect(pdf.rows).toEqual((await getLeagueScorers(f.leagues[0].id, { upToRound: 1 })).rows);
  });
});
