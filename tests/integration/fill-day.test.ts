import { beforeAll, describe, expect, it } from "vitest";
import { cancelMatch, createMatch, proposeDayFill, teamsWithoutMatch } from "@/server/services/matches";
import { saveResult } from "@/server/services/results";
import { getLeagueStandings } from "@/server/services/standings";
import { createFixture, quickMatch, type Fixture } from "../support/fixtures";

let f: Fixture;
const date = "2026-09-13";

beforeAll(async () => {
  // Liga A con 5 equipos (uno descansa) y liga B con 4.
  f = await createFixture({ teamsA: 5, teamsB: 4, referees: 4 });
  const [a1, a2, a3, a4] = f.teamsA;
  const [b1, b2, b3, b4] = f.teamsB;
  await quickMatch(f, a1.id, a2.id, date, 0, 0);
  await quickMatch(f, a3.id, a4.id, date, 0, 1);
  await quickMatch(f, b1.id, b2.id, date, 1, 0, { leagueId: f.leagues[1].id });
  const cancelled = await quickMatch(f, b3.id, b4.id, date, 1, 1, { leagueId: f.leagues[1].id });
  await cancelMatch(cancelled.id, "No se presentó el árbitro de la cancha", f.userId);
});

describe("completar jornada (base de datos)", () => {
  it("detecta equipos sin partido por descanso y por cancelación", async () => {
    const idle = await teamsWithoutMatch(f.season.id, date);
    expect(idle.map((t) => t.name).sort()).toEqual([f.teamsA[4].name, f.teamsB[2].name, f.teamsB[3].name].sort());
    expect(idle.find((t) => t.id === f.teamsB[2].id)?.reason).toBe("Partido cancelado");
    expect(idle.find((t) => t.id === f.teamsA[4].id)?.reason).toMatch(/descanso/);
  });

  it("propone primero la misma liga y deja reportado al equipo sin rival", async () => {
    const p = await proposeDayFill(f.season.id, date);
    expect(p.pairs).toHaveLength(1);
    expect(p.pairs[0].crossLeague).toBe(false);
    expect([p.pairs[0].home, p.pairs[0].away].sort()).toEqual([f.teamsB[2].id, f.teamsB[3].id].sort());
    expect(p.unpaired.map((t) => t.id)).toEqual([f.teamsA[4].id]);
  });

  it("combina entre ligas a los equipos que descansan, con espacio y árbitro libres, y se puede crear", async () => {
    // Cada liga con número impar: descansa un equipo de cada una.
    const g = await createFixture({ teamsA: 5, teamsB: 3, referees: 3 });
    const d2 = "2026-09-20";
    await quickMatch(g, g.teamsA[0].id, g.teamsA[1].id, d2, 0, 0);
    await quickMatch(g, g.teamsA[2].id, g.teamsA[3].id, d2, 0, 1);
    await quickMatch(g, g.teamsB[0].id, g.teamsB[1].id, d2, 1, 0, { leagueId: g.leagues[1].id });
    const p = await proposeDayFill(g.season.id, d2);
    expect(p.pairs).toHaveLength(1);
    const pair = p.pairs[0];
    expect(pair.crossLeague).toBe(true);
    expect([pair.home, pair.away].sort()).toEqual([g.teamsA[4].id, g.teamsB[2].id].sort());
    expect(pair.timeSlotId).not.toBeNull();
    expect(pair.refereeId).not.toBeNull();
    const { match } = await createMatch(
      g.season.id,
      { type: "INTERLIGA", countsForStandings: false, homeTeamId: pair.home, awayTeamId: pair.away, date: d2, timeSlotId: pair.timeSlotId, fieldId: pair.fieldId, refereeId: pair.refereeId },
      { confirm: true, userId: g.userId },
    );
    expect(match.status).toBe("PROGRAMADO");
    expect(match.countsForStandings).toBe(true);
    expect(await teamsWithoutMatch(g.season.id, d2)).toHaveLength(0);
    // Todos los partidos cuentan: cada equipo suma en la tabla de su propia liga.
    await saveResult(match.id, { resultType: "TIEMPO_REGULAR", homeGoals: 2, awayGoals: 1, scorers: [] }, g.userId);
    const winner = match.homeTeamId;
    const loser = match.awayTeamId;
    const tables = await Promise.all(g.leagues.map((l) => getLeagueStandings(l.id)));
    const rowOf = (id: string) => tables.flatMap((t) => t.rows).find((r) => r.teamId === id)!;
    expect(rowOf(winner)).toMatchObject({ jj: 1, jg: 1, pts: 3 });
    expect(rowOf(loser)).toMatchObject({ jj: 1, jp: 1, pts: 0 });
    // y no aparece en la tabla de la otra liga
    for (const t of tables) expect(t.rows.filter((r) => r.teamId === winner || r.teamId === loser)).toHaveLength(1);
  });
});
