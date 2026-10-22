import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { revertResult, saveResult } from "@/server/services/results";
import { cancelMatch } from "@/server/services/matches";
import { getLeagueScorers, getLeagueStandings } from "@/server/services/standings";
import { ActionError } from "@/server/errors";
import { createFixture, quickMatch, type Fixture } from "../support/fixtures";

let f: Fixture;
const row = async (teamId: string) => (await getLeagueStandings(f.leagues[0].id)).rows.find((r) => r.teamId === teamId)!;

beforeAll(async () => {
  f = await createFixture();
});

describe("resultados y puntuación (base de datos)", () => {
  it("victoria en tiempo regular: 3 puntos al ganador, 0 al perdedor; guardar dos veces no duplica", async () => {
    const [a, b] = f.teamsA;
    const m = await quickMatch(f, a.id, b.id, "2026-08-02", 0, 0);
    const input = { resultType: "TIEMPO_REGULAR" as const, homeGoals: 3, awayGoals: 1, scorers: [{ playerId: a.players[0].id, teamId: a.id, goals: 2 }] };
    await saveResult(m.id, input, f.userId);
    const again = await saveResult(m.id, input, f.userId);
    expect(again.unchanged).toBe(true);
    expect(await prisma.matchResult.count({ where: { matchId: m.id } })).toBe(1);
    expect(await row(a.id)).toMatchObject({ jj: 1, jg: 1, pts: 3, gf: 3, ge: 1 });
    expect(await row(b.id)).toMatchObject({ jj: 1, jp: 1, pts: 0 });
    expect((await prisma.match.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("JUGADO");
  });

  it("desempate: 2 puntos al ganador y 1 al perdedor; los penales no suman goles ni goleo", async () => {
    const [, , c, d] = f.teamsA;
    const m = await quickMatch(f, c.id, d.id, "2026-08-02", 1, 0);
    await saveResult(m.id, { resultType: "DESEMPATE", homeGoals: 2, awayGoals: 2, homeShootout: 4, awayShootout: 5, scorers: [] }, f.userId);
    expect(await row(c.id)).toMatchObject({ jj: 1, ep: 1, pts: 1, gf: 2, ge: 2 });
    expect(await row(d.id)).toMatchObject({ jj: 1, eg: 1, pts: 2, gf: 2, ge: 2 });
  });

  it("rechaza goleadores que exceden el marcador y empates no configurados", async () => {
    const [a, , , , e] = f.teamsA;
    const m = await quickMatch(f, a.id, e.id, "2026-08-09", 0, 0);
    await expect(
      saveResult(m.id, { resultType: "TIEMPO_REGULAR", homeGoals: 1, awayGoals: 0, scorers: [{ playerId: a.players[0].id, teamId: a.id, goals: 2 }] }, f.userId),
    ).rejects.toBeInstanceOf(ActionError);
    await expect(saveResult(m.id, { resultType: "EMPATE", homeGoals: 1, awayGoals: 1, scorers: [] }, f.userId)).rejects.toThrow(/empate definitivo/i);
    expect(await prisma.matchResult.count({ where: { matchId: m.id } })).toBe(0);
  });

  it("corrección exige motivo, recalcula y queda en el historial con valor anterior y nuevo", async () => {
    const [a, , , , , g] = f.teamsA;
    const m = await quickMatch(f, a.id, g.id, "2026-08-16", 0, 0);
    await saveResult(m.id, { resultType: "TIEMPO_REGULAR", homeGoals: 2, awayGoals: 0, scorers: [] }, f.userId);
    const before = await row(g.id);
    await expect(saveResult(m.id, { resultType: "TIEMPO_REGULAR", homeGoals: 0, awayGoals: 1, scorers: [] }, f.userId)).rejects.toThrow(/motivo/i);
    await saveResult(m.id, { resultType: "TIEMPO_REGULAR", homeGoals: 0, awayGoals: 1, scorers: [], reason: "Error de captura" }, f.userId);
    const after = await row(g.id);
    expect(after.pts).toBe(before.pts + 3);
    expect(after.jj).toBe(before.jj);
    const log = await prisma.auditLog.findFirst({ where: { entityId: m.id, action: "CORRECCION_RESULTADO" } });
    expect(log?.reason).toBe("Error de captura");
    expect(JSON.stringify(log?.before)).toContain("2-0");
    expect(JSON.stringify(log?.after)).toContain("0-1");
  });

  it("revertir un resultado recalcula todas las estadísticas", async () => {
    const [, b, c] = f.teamsA;
    const m = await quickMatch(f, b.id, c.id, "2026-08-23", 0, 0);
    const before = await row(b.id);
    await saveResult(m.id, { resultType: "TIEMPO_REGULAR", homeGoals: 5, awayGoals: 0, scorers: [] }, f.userId);
    expect((await row(b.id)).pts).toBe(before.pts + 3);
    await revertResult(m.id, "Capturado en el partido equivocado", f.userId);
    expect(await row(b.id)).toMatchObject({ pts: before.pts, jj: before.jj, gf: before.gf });
    expect((await prisma.match.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("PROGRAMADO");
  });

  it("partidos cancelados no reciben resultado ni generan puntos", async () => {
    const [, , , d, e] = f.teamsA;
    const m = await quickMatch(f, d.id, e.id, "2026-08-30", 0, 0);
    const before = await row(e.id);
    await cancelMatch(m.id, "No se presentó el rival", f.userId);
    await expect(saveResult(m.id, { resultType: "TIEMPO_REGULAR", homeGoals: 3, awayGoals: 0, scorers: [] }, f.userId)).rejects.toThrow(/cancelado/i);
    expect(await row(e.id)).toEqual(before);
  });

  it("los amistosos no alteran la tabla ni el goleo oficial", async () => {
    const [a] = f.teamsA;
    const [x] = f.teamsB;
    const before = await row(a.id);
    const scorersBefore = await getLeagueScorers(f.leagues[0].id);
    const m = await quickMatch(f, a.id, x.id, "2026-09-06", 0, 0, { type: "AMISTOSO", countsForStandings: false });
    await saveResult(m.id, { resultType: "TIEMPO_REGULAR", homeGoals: 7, awayGoals: 0, scorers: [{ playerId: a.players[1].id, teamId: a.id, goals: 7 }] }, f.userId);
    expect(await row(a.id)).toEqual(before);
    const scorersAfter = await getLeagueScorers(f.leagues[0].id);
    expect(scorersAfter.rows.find((r) => r.playerId === a.players[1].id)).toBeUndefined();
    expect(scorersAfter.rows.length).toBe(scorersBefore.rows.length);
  });

  it("tabla de goleo: suma goles individuales por jugador y ordena de mayor a menor", async () => {
    const goleo = await getLeagueScorers(f.leagues[0].id);
    const top = goleo.rows[0];
    expect(top.playerId).toBe(f.teamsA[0].players[0].id);
    expect(top.goals).toBe(2);
  });
});
