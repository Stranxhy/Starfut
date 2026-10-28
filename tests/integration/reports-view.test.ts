import { beforeAll, describe, expect, it } from "vitest";
import { quickReportHref, type QuickReportDoc } from "@/domain/reports-view";
import { loadHistory, loadResults, loadRol, loadScorers, loadStandings } from "@/pdf/data";
import { saveResult } from "@/server/services/results";
import { createFixture, quickMatch, type Fixture } from "../support/fixtures";

let f: Fixture;
let matchId: string;
beforeAll(async () => {
  f = await createFixture({ teamsA: 2, teamsB: 1 });
  const [home, away] = f.teamsA;
  const match = await quickMatch(f, home.id, away.id, "2026-08-02");
  matchId = match.id;
  await saveResult(match.id, { resultType: "TIEMPO_REGULAR", homeGoals: 2, awayGoals: 0, scorers: [{ playerId: home.players[0].id, teamId: home.id, goals: 2 }] }, f.userId);
});
const params = (doc: QuickReportDoc, download = false) => new URL(quickReportHref(doc, f.season.id, f.leagues[0].id, "2026-08-02", download)!, "http://test").searchParams;

describe("documentos desde el centro de reportes", () => {
  it("abre y descarga el mismo rol y resultados de la liga, fecha y temporada elegidas", async () => {
    for (const [doc, load] of [["rol", loadRol], ["resultados", loadResults]] as const) {
      for (const download of [false, true]) {
        const query = params(doc, download);
        const data = await load(query.get("season")!, query);
        expect(data.meta.seasonId).toBe(f.season.id);
        expect(data.date).toBe("2026-08-02");
        expect(data.leagueName).toBe(f.leagues[0].name);
        expect(data.groups.flatMap((group) => group.lines.map((match) => match.id))).toContain(matchId);
      }
    }
  });
  it("genera tabla y goleo acumulados con los parámetros de los accesos rápidos", async () => {
    const standingsQuery = params("tabla-general");
    const standings = await loadStandings(standingsQuery.get("season")!, standingsQuery);
    expect(standings.standings.rows.find((row) => row.teamId === f.teamsA[0].id)?.pts).toBeGreaterThan(0);
    const scorersQuery = params("goleo");
    const scorers = await loadScorers(scorersQuery.get("season")!, scorersQuery);
    expect(scorers.includePlayoffs).toBe(false);
    expect(scorers.rows.find((row) => row.playerId === f.teamsA[0].players[0].id)?.goals).toBe(2);
  });
  it("admite historial de toda la temporada y filtros compatibles de liga y equipo", async () => {
    const all = await loadHistory(f.season.id, new URLSearchParams());
    expect(all.total).toBe(1);
    const selected = await loadHistory(f.season.id, new URLSearchParams({ league: f.leagues[0].id, team: f.teamsA[0].id }));
    expect(selected.total).toBe(1);
    expect(selected.teamName).toBe(f.teamsA[0].name);
    await expect(loadHistory(f.season.id, new URLSearchParams({ league: f.leagues[0].id, team: f.teamsB[0].id }))).rejects.toThrow("no pertenece");
  });
});
