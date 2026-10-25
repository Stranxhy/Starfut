import { describe, expect, it } from "vitest";
import { circleRoundRobin, pairKey, roundsPerCycle } from "@/domain/roundRobin";
import { buildRoundDates, generateSchedule, type SchedulerInput } from "@/domain/scheduler";
import { hungarian } from "@/domain/hungarian";

const SLOTS = ["08:10", "09:00", "09:50", "10:40", "11:30", "12:20"].map((t, i) => ({ id: `ts${i}`, startTime: t }));
const FIELDS = [1, 2, 3, 4, 5].map((n) => ({ id: `f${n}`, name: `Cancha ${n}` }));
const team = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i + 1}`, name: `${prefix} ${i + 1}` }));

function baseInput(over: Partial<SchedulerInput> = {}): SchedulerInput {
  const dates = buildRoundDates("2026-08-02", 0, 14);
  return {
    leagues: [
      { id: "L1", name: "Premium", teams: team("P", 14) },
      { id: "L2", name: "Liga B", teams: team("B", 12) },
    ],
    rounds: dates.map((d, i) => ({ number: i + 1, date: d })),
    timeSlots: SLOTS,
    fields: FIELDS,
    seed: 42,
    ...over,
  };
}

function assertNoClashes(rounds: ReturnType<typeof generateSchedule>["rounds"]) {
  for (const r of rounds) {
    const fieldSlot = new Set<string>();
    const teamSlot = new Set<string>();
    const teamDay = new Set<string>();
    for (const m of r.matches) {
      if (!m.timeSlotId) continue;
      const fk = `${m.timeSlotId}|${m.fieldId}`;
      expect(fieldSlot.has(fk)).toBe(false);
      fieldSlot.add(fk);
      for (const t of [m.homeTeamId, m.awayTeamId]) {
        expect(teamSlot.has(`${m.timeSlotId}|${t}`)).toBe(false);
        teamSlot.add(`${m.timeSlotId}|${t}`);
        expect(teamDay.has(t)).toBe(false); // un partido por equipo por jornada
        teamDay.add(t);
      }
    }
  }
}

describe("round robin", () => {
  it("con n par cada pareja aparece exactamente una vez", () => {
    const ids = team("T", 8).map((t) => t.id);
    const rounds = circleRoundRobin(ids);
    expect(rounds).toHaveLength(7);
    const pairs = rounds.flatMap((r) => r.pairings.map((p) => pairKey(p.home, p.away)));
    expect(new Set(pairs).size).toBe(28);
    expect(pairs).toHaveLength(28);
  });
  it("con n impar cada equipo descansa exactamente una vez", () => {
    const ids = team("T", 7).map((t) => t.id);
    const rounds = circleRoundRobin(ids);
    expect(rounds).toHaveLength(7);
    const byes = rounds.map((r) => r.bye);
    expect(new Set(byes).size).toBe(7);
    expect(roundsPerCycle(7)).toBe(7);
  });
});

describe("hungarian", () => {
  it("encuentra la asignación de costo mínimo", () => {
    const a = hungarian([
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ]);
    const total = a.reduce((s, c, i) => s + [[4, 1, 3], [2, 0, 5], [3, 2, 2]][i][c], 0);
    expect(total).toBe(5);
  });
});

describe("generateSchedule", () => {
  it("genera 14 jornadas sin repeticiones cuando es posible (14 y 12 equipos)", () => {
    // 12 equipos → 11 jornadas sin repetir; 14 equipos → 13. Ambos < 14: repeticiones inevitables.
    const out = generateSchedule(baseInput({ leagues: [{ id: "L1", name: "Premium", teams: team("P", 16) }] }));
    expect(out.errors).toEqual([]);
    expect(out.rounds).toHaveLength(14);
    expect(out.summary.totalMatches).toBe(14 * 8);
    expect(out.summary.repeatedMatches).toBe(0);
    expect(out.summary.leagues[0].repeatsUnavoidable).toBe(false);
    assertNoClashes(out.rounds);
  });

  it("detecta y reporta repeticiones inevitables", () => {
    const out = generateSchedule(baseInput());
    expect(out.errors).toEqual([]);
    const l2 = out.summary.leagues.find((l) => l.leagueId === "L2")!;
    expect(l2.repeatsUnavoidable).toBe(true);
    expect(l2.roundsWithoutRepeats).toBe(11);
    // Las primeras 11 jornadas de la liga B no repiten rivales
    const firstCycle = out.rounds.slice(0, 11).flatMap((r) => r.matches.filter((m) => m.leagueId === "L2"));
    expect(firstCycle.every((m) => m.repeatIndex === 0)).toBe(true);
    expect(out.warnings.some((w) => w.includes("inevitable"))).toBe(true);
    assertNoClashes(out.rounds);
  });

  it("maneja número impar de equipos con descansos", () => {
    const out = generateSchedule(baseInput({ leagues: [{ id: "L1", name: "Impar", teams: team("I", 13) }] }));
    expect(out.errors).toEqual([]);
    for (const r of out.rounds) {
      expect(r.byes).toHaveLength(1);
      expect(r.matches).toHaveLength(6);
    }
    const restCount = new Map<string, number>();
    for (const r of out.rounds.slice(0, 13)) for (const b of r.byes) restCount.set(b.teamId, (restCount.get(b.teamId) ?? 0) + 1);
    expect([...restCount.values()].every((c) => c === 1)).toBe(true);
    assertNoClashes(out.rounds);
  });

  it("reparte horarios: ningún equipo juega siempre en el mismo horario", () => {
    const out = generateSchedule(baseInput({ leagues: [{ id: "L1", name: "P", teams: team("P", 16) }] }));
    for (const [, dist] of Object.entries(out.summary.slotDistribution)) {
      const max = Math.max(...Object.values(dist));
      expect(max).toBeLessThanOrEqual(5);
    }
  });

  it("detecta situación imposible por falta de espacios", () => {
    const out = generateSchedule(
      baseInput({ timeSlots: SLOTS.slice(0, 1), fields: FIELDS.slice(0, 2) }),
    );
    expect(out.errors.length).toBeGreaterThan(0);
    expect(out.errors[0]).toContain("espacios");
  });

  it("respeta canchas bloqueadas y restricciones de equipos", () => {
    const dates = buildRoundDates("2026-08-02", 0, 14);
    const out = generateSchedule(
      baseInput({
        leagues: [{ id: "L1", name: "P", teams: team("P", 8) }],
        fieldBlocks: [{ fieldId: "f1", date: dates[0], timeSlotId: null }],
        teamRestrictions: [{ teamId: "P1", date: null, timeSlotId: "ts0" }],
      }),
    );
    expect(out.rounds[0].matches.some((m) => m.fieldId === "f1")).toBe(false);
    const p1 = out.rounds.flatMap((r) => r.matches).filter((m) => m.homeTeamId === "P1" || m.awayTeamId === "P1");
    expect(p1.some((m) => m.timeSlotId === "ts0")).toBe(false);
  });

  it("minimiza repeticiones respecto de partidos existentes", () => {
    const ids = team("P", 6);
    const existing: Record<string, number> = { [pairKey("P1", "P2")]: 1, [pairKey("P3", "P4")]: 1 };
    const out = generateSchedule(
      baseInput({
        leagues: [{ id: "L1", name: "P", teams: ids }],
        rounds: buildRoundDates("2026-08-02", 0, 3).map((d, i) => ({ number: i + 1, date: d })),
        existingPairs: existing,
      }),
    );
    expect(out.summary.repeatedMatches).toBe(0);
  });

  it("la misma semilla produce el mismo calendario; otra semilla, uno distinto", () => {
    const a = generateSchedule(baseInput({ seed: 7 }));
    const b = generateSchedule(baseInput({ seed: 7 }));
    const c = generateSchedule(baseInput({ seed: 8 }));
    const sig = (x: typeof a) => x.rounds[0].matches.map((m) => `${m.homeTeamId}-${m.awayTeamId}`).join(",");
    expect(sig(a)).toBe(sig(b));
    expect(sig(a)).not.toBe(sig(c));
  });
});

describe("buildRoundDates", () => {
  it("genera domingos consecutivos saltando fechas excluidas", () => {
    const d = buildRoundDates("2026-10-01", 0, 3, ["2026-10-11"]);
    expect(d).toEqual(["2026-10-04", "2026-10-18", "2026-10-25"]);
  });
});
