import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { buildRoundDates } from "@/domain/scheduler";
import { confirmDraft, createDraft, firstEditableRound } from "@/server/services/schedule";
import { cancelMatch, createMatch, updateMatch } from "@/server/services/matches";
import { getLeagueStandings } from "@/server/services/standings";
import { saveResult } from "@/server/services/results";
import { ActionError } from "@/server/errors";
import { createFixture, type Fixture } from "../support/fixtures";

let f: Fixture;
const dates = buildRoundDates("2026-08-02", 0, 14);

beforeAll(async () => {
  f = await createFixture({ teamsA: 7, teamsB: 6 });
});

describe("calendario automático (base de datos)", () => {
  it("genera vista previa, exige confirmar advertencias y crea 14 jornadas protegidas sin conflictos", async () => {
    const { draft, data } = await createDraft(f.season.id, { fromRound: 1, dates, seed: 123, leagueIds: f.leagues.map((l) => l.id) }, f.userId);
    expect(data.errors).toEqual([]);
    expect(data.rounds).toHaveLength(14);
    // 7 equipos (impar): 7 jornadas sin repetir → repeticiones inevitables, se reportan
    const a = data.summary.leagues.find((l) => l.leagueId === f.leagues[0].id)!;
    expect(a.repeatsUnavoidable).toBe(true);
    expect(data.warnings.join(" ")).toMatch(/inevitable/);
    // Nada se guarda en el calendario antes de confirmar
    expect(await prisma.match.count({ where: { seasonId: f.season.id } })).toBe(0);
    await expect(confirmDraft(draft.id, { acknowledgeIssues: false }, f.userId)).rejects.toMatchObject({ extra: { needsConfirmation: true } });
    await confirmDraft(draft.id, { acknowledgeIssues: true }, f.userId);

    const matches = await prisma.match.findMany({ where: { seasonId: f.season.id } });
    expect(matches).toHaveLength(14 * (3 + 3));
    expect(matches.every((m) => m.locked)).toBe(true);
    const rounds = await prisma.round.findMany({ where: { seasonId: f.season.id } });
    expect(rounds).toHaveLength(14);
    expect(rounds.every((r) => r.locked)).toBe(true);
    // Sin cancha duplicada ni equipo simultáneo
    const seen = new Set<string>();
    for (const m of matches) {
      const d = m.date!.toISOString();
      for (const k of [`f|${d}|${m.timeSlotId}|${m.fieldId}`, `t|${d}|${m.timeSlotId}|${m.homeTeamId}`, `t|${d}|${m.timeSlotId}|${m.awayTeamId}`]) {
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
    }
    // Primer ciclo de la liga A sin repeticiones
    const firstCycle = matches.filter((m) => m.leagueId === f.leagues[0].id && m.date! < new Date(`${dates[7]}T00:00:00Z`));
    const pairs = firstCycle.map((m) => [m.homeTeamId, m.awayTeamId].sort().join("|"));
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(await prisma.auditLog.count({ where: { entityId: f.season.id, action: "CALENDARIO_CONFIRMADO" } })).toBe(1);
  });

  it("no regenera jornadas confirmadas", async () => {
    expect(await firstEditableRound(f.season.id)).toBe(15);
    await expect(createDraft(f.season.id, { fromRound: 1, dates, seed: 1, leagueIds: [f.leagues[0].id] }, f.userId)).rejects.toBeInstanceOf(ActionError);
  });

  it("un partido de calendario confirmado exige motivo; al cambiar de fecha queda reprogramado y se registra", async () => {
    const m = await prisma.match.findFirstOrThrow({ where: { seasonId: f.season.id, date: new Date(`${dates[13]}T00:00:00Z`) } });
    await expect(updateMatch(m.id, { timeSlotId: f.timeSlots[5].id }, { confirm: true, userId: f.userId })).rejects.toThrow(/motivo/i);
    const newDate = "2026-11-15";
    const { match } = await updateMatch(
      m.id,
      { date: newDate, timeSlotId: f.timeSlots[0].id, fieldId: f.fields[0].id, reason: "Lluvia" },
      { confirm: true, userId: f.userId },
    );
    expect(match.status).toBe("REPROGRAMADO");
    expect(match.originalDate?.toISOString().slice(0, 10)).toBe(dates[13]);
    const log = await prisma.auditLog.findFirst({ where: { entityId: m.id, action: "REPROGRAMAR" } });
    expect(log?.reason).toBe("Lluvia");
  });

  it("detecta conflicto de cancha y equipo simultáneo", async () => {
    const [x, y] = await prisma.match.findMany({ where: { seasonId: f.season.id, date: new Date(`${dates[12]}T00:00:00Z`) }, take: 2, orderBy: { timeSlotId: "asc" } });
    // Mover y al mismo horario y cancha de x
    await expect(
      updateMatch(y.id, { timeSlotId: x.timeSlotId, fieldId: x.fieldId, reason: "prueba" }, { confirm: true, userId: f.userId }),
    ).rejects.toThrow(/ocupada|misma hora/);
  });

  it("partido entre ligas exige tipo extraordinario; un amistoso no afecta la tabla", async () => {
    const date = "2026-12-06";
    const [a] = f.teamsA;
    const [b] = f.teamsB;
    const base = { homeTeamId: a.id, awayTeamId: b.id, date, timeSlotId: f.timeSlots[2].id, fieldId: f.fields[2].id };
    await expect(createMatch(f.season.id, { ...base, type: "OFICIAL" }, { confirm: true, userId: f.userId })).rejects.toThrow(/ligas diferentes/);
    // INTERLIGA con interliga desactivada: advertencia que requiere confirmación
    await prisma.season.update({ where: { id: f.season.id }, data: { allowInterLeague: false } });
    await expect(createMatch(f.season.id, { ...base, type: "INTERLIGA" }, { confirm: false, userId: f.userId })).rejects.toMatchObject({ extra: { needsConfirmation: true } });
    const before = (await getLeagueStandings(f.leagues[0].id)).rows.find((r) => r.teamId === a.id)!;
    const { match } = await createMatch(f.season.id, { ...base, type: "AMISTOSO" }, { confirm: true, userId: f.userId });
    expect(match.countsForStandings).toBe(false);
    await saveResult(match.id, { resultType: "TIEMPO_REGULAR", homeGoals: 4, awayGoals: 0, scorers: [] }, f.userId);
    expect((await getLeagueStandings(f.leagues[0].id)).rows.find((r) => r.teamId === a.id)).toEqual(before);
  });

  it("cancelación conserva historial y permite un partido de sustitución en el mismo espacio", async () => {
    const m = await prisma.match.findFirstOrThrow({ where: { seasonId: f.season.id, leagueId: f.leagues[0].id, date: new Date(`${dates[11]}T00:00:00Z`) } });
    await cancelMatch(m.id, "El visitante no se presentará", f.userId);
    const cancelled = await prisma.match.findUniqueOrThrow({ where: { id: m.id } });
    expect(cancelled.status).toBe("CANCELADO");
    expect(cancelled.fieldId).toBe(m.fieldId); // conserva sus datos
    // Rival sustituto que no juegue en ese horario
    const busy = await prisma.match.findMany({ where: { date: m.date, timeSlotId: m.timeSlotId, status: { not: "CANCELADO" } } });
    const busyTeams = new Set(busy.flatMap((x) => [x.homeTeamId, x.awayTeamId]));
    const rival = f.teamsA.find((t) => t.id !== m.homeTeamId && t.id !== m.awayTeamId && !busyTeams.has(t.id))!;
    const { match: sub } = await createMatch(
      f.season.id,
      { type: "SUSTITUCION", homeTeamId: m.homeTeamId, awayTeamId: rival.id, date: dates[11], timeSlotId: m.timeSlotId, fieldId: m.fieldId, replacesMatchId: m.id },
      { confirm: true, userId: f.userId },
    );
    expect(sub.countsForStandings).toBe(true);
    expect(sub.replacesMatchId).toBe(m.id);
    expect(await prisma.auditLog.count({ where: { entityId: m.id, action: "CANCELAR" } })).toBe(1);
  });

  it("restricción única de equipo duplicado en la misma liga", async () => {
    const t = f.teamsA[0];
    await expect(prisma.team.create({ data: { seasonId: f.season.id, leagueId: t.leagueId, name: t.name, nameKey: t.nameKey } })).rejects.toMatchObject({ code: "P2002" });
  });
});
