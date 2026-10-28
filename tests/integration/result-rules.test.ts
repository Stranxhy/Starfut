import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resultRuleScope } from "@/domain/match-presentation";
import { getScoringRules } from "@/server/services/rules";
import { saveResult } from "@/server/services/results";
import { MATCH_INCLUDE } from "@/server/services/matches";
import { createFixture, quickMatch, type Fixture } from "../support/fixtures";

let f: Fixture;
beforeAll(async () => {
  f = await createFixture({ teamsA: 2, teamsB: 1 });
  await prisma.scoringConfig.create({ data: {
    seasonId: f.season.id, leagueId: f.leagues[0].id,
    winPoints: 3, lossPoints: 0, shootoutWinPoints: 2, shootoutLossPoints: 1,
    allowDraws: true, drawPoints: 1, shootoutKicks: 5,
  } });
});

describe("reglas ofrecidas en la captura de resultados", () => {
  it("ofrece el empate de la liga y el servidor acepta ese resultado", async () => {
    const match = await quickMatch(f, f.teamsA[0].id, f.teamsA[1].id, "2026-10-25");
    const m = await prisma.match.findUniqueOrThrow({ where: { id: match.id }, include: MATCH_INCLUDE });
    const rules = await getScoringRules(f.season.id, resultRuleScope(m));
    expect(rules).toMatchObject({ allowDraws: true, drawPoints: 1, shootoutKicks: 5 });
    await saveResult(m.id, { resultType: "EMPATE", homeGoals: 0, awayGoals: 0, scorers: [] }, f.userId);
    expect(await prisma.matchResult.findUnique({ where: { matchId: m.id } })).toMatchObject({ resultType: "EMPATE", homeGoals: 0, awayGoals: 0 });
  });
  it("usa las reglas de temporada para un interliga aunque tenga una liga asociada", async () => {
    const match = await quickMatch(f, f.teamsA[0].id, f.teamsB[0].id, "2026-11-01", 0, 0, { type: "INTERLIGA" });
    const m = await prisma.match.findUniqueOrThrow({ where: { id: match.id }, include: MATCH_INCLUDE });
    const rules = await getScoringRules(f.season.id, resultRuleScope(m));
    expect(rules.allowDraws).toBe(false);
    await expect(saveResult(m.id, { resultType: "EMPATE", homeGoals: 1, awayGoals: 1, scorers: [] }, f.userId)).rejects.toThrow(/empate definitivo/i);
    await saveResult(m.id, { resultType: "DESEMPATE", homeGoals: 1, awayGoals: 1, homeShootout: 4, awayShootout: 3, scorers: [] }, f.userId);
    expect(await prisma.matchResult.findUnique({ where: { matchId: m.id } })).toMatchObject({ resultType: "DESEMPATE", homeGoals: 1, awayGoals: 1, winnerTeamId: f.teamsA[0].id });
  });
});
