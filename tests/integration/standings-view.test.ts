import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { loadStandings } from "@/pdf/data";
import { getLeagueStandings } from "@/server/services/standings";
import { saveResult } from "@/server/services/results";
import { createFixture, quickMatch, type Fixture } from "../support/fixtures";

let f: Fixture;

beforeAll(async () => {
  f = await createFixture({ teamsA: 2, teamsB: 0 });
  const [a, b] = f.teamsA;
  const first = await quickMatch(f, a.id, b.id, "2026-08-02");
  const second = await quickMatch(f, a.id, b.id, "2026-08-09");
  for (const [number, match] of [[1, first], [2, second]] as const) {
    const round = await prisma.round.create({ data: { seasonId: f.season.id, number, date: match.date! } });
    await prisma.match.update({ where: { id: match.id }, data: { roundId: round.id } });
  }
  await saveResult(first.id, { resultType: "TIEMPO_REGULAR", homeGoals: 3, awayGoals: 0, scorers: [] }, f.userId);
  await saveResult(second.id, { resultType: "TIEMPO_REGULAR", homeGoals: 0, awayGoals: 1, scorers: [] }, f.userId);
  const frozen = await getLeagueStandings(f.leagues[0].id);
  await prisma.standingSnapshot.create({ data: {
    seasonId: f.season.id, leagueId: f.leagues[0].id,
    rows: JSON.parse(JSON.stringify(frozen.rows)), createdById: f.userId,
  } });
  await saveResult(first.id, { resultType: "TIEMPO_REGULAR", homeGoals: 0, awayGoals: 1, scorers: [], reason: "Corrección posterior del acta" }, f.userId);
});

const params = (values: Record<string, string> = {}) => new URLSearchParams({ league: f.leagues[0].id, ...values });

describe("la exportación respeta la tabla consultada", () => {
  it("conserva la clasificación congelada por defecto y al pedir el cierre", async () => {
    const selections: Record<string, string>[] = [{}, { view: "final" }];
    for (const values of selections) {
      const pdf = await loadStandings(f.season.id, params(values));
      expect(pdf.standings.frozen).toBe(true);
      expect(pdf.standings.rows.map((row) => [row.teamId, row.pts])).toEqual([[f.teamsA[0].id, 3], [f.teamsA[1].id, 3]]);
    }
  });
  it("exporta el cálculo actual cuando se elige esa vista aunque haya un cierre", async () => {
    const pdf = await loadStandings(f.season.id, params({ view: "actual" }));
    const web = await getLeagueStandings(f.leagues[0].id);
    expect(pdf.standings.frozen).toBe(false);
    expect(pdf.standings.rows).toEqual(web.rows);
    expect(pdf.standings.rows[0]).toMatchObject({ teamId: f.teamsA[1].id, pts: 6, jj: 2 });
  });
  it("una jornada histórica tiene prioridad sobre el cierre en la exportación", async () => {
    const pdf = await loadStandings(f.season.id, params({ view: "final", round: "1" }));
    expect(pdf.standings.frozen).toBe(false);
    expect(pdf.standings.rows[0]).toMatchObject({ teamId: f.teamsA[1].id, pts: 3, jj: 1 });
    expect(pdf.round).toBe(1);
    expect(pdf.standings.rows).toEqual((await getLeagueStandings(f.leagues[0].id, { upToRound: 1 })).rows);
  });
});
