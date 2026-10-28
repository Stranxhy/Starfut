import { describe, expect, it } from "vitest";
import { getDashboard } from "@/server/services/dashboard";
import { createFixture, quickMatch } from "../support/fixtures";

describe("datos de Inicio", () => {
  it("una temporada vacía no se confunde con partidos preparados", async () => {
    const fixture = await createFixture({ teamsA: 0, teamsB: 0 });
    const dashboard = await getDashboard(fixture.season.id);
    expect(dashboard).toMatchObject({ hasMatches: false, hasDraft: false, pendingResultDate: null, totals: { teams: 0, pendingResult: 0, scheduled: 0 } });
  });

  it("reconoce partidos manuales y enlaza la fecha atrasada más antigua", async () => {
    const fixture = await createFixture({ teamsA: 2, teamsB: 0 });
    const [home, away] = fixture.teamsA;
    await quickMatch(fixture, home.id, away.id, "2021-08-08");
    await quickMatch(fixture, away.id, home.id, "2021-08-01");
    const dashboard = await getDashboard(fixture.season.id);
    expect(dashboard).toMatchObject({ hasMatches: true, pendingResultDate: "2021-08-01", totals: { pendingResult: 2, played: 0 } });
  });
});
