import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRACKET,
  defaultZones,
  resolveSource,
  stageReady,
  validateBracket,
  zoneForPosition,
} from "@/domain/bracket";
import { computeScorers, validateScorers } from "@/domain/scorers";
import { checkMatchConflicts, type ConflictContext } from "@/domain/conflicts";
import { nextStatusAfterServing, sanctionProgress } from "@/domain/sanctions";
import { normalizeName } from "@/domain/text";

describe("bracket", () => {
  it("el cuadro por defecto es válido con 12 o más equipos", () => {
    expect(validateBracket(DEFAULT_BRACKET, 26)).toEqual([]);
    expect(validateBracket(DEFAULT_BRACKET, 12)).toEqual([]);
  });
  it("detecta cuadros incompletos con menos equipos", () => {
    const errs = validateBracket(DEFAULT_BRACKET, 10);
    expect(errs.some((e) => e.includes("12.º"))).toBe(true);
  });
  it("detecta referencias inválidas", () => {
    const errs = validateBracket(
      { stages: [{ code: "FINAL", name: "Final", ties: [{ home: "W:SEMI:1", away: "S1" }] }] },
      8,
    );
    expect(errs.length).toBeGreaterThan(0);
  });
  it("resuelve orígenes y determina si una etapa está lista", () => {
    const seeds = Array.from({ length: 12 }, (_, i) => `T${i + 1}`);
    expect(resolveSource("S5", seeds, {})).toBe("T5");
    expect(stageReady(DEFAULT_BRACKET.stages[0], seeds, {})).toBe(true);
    expect(stageReady(DEFAULT_BRACKET.stages[1], seeds, {})).toBe(false);
    const outcomes = { REPECHAJE: { winners: ["T12", "T6", "T7", "T8"], losers: ["T5", "T11", "T10", "T9"] } };
    expect(stageReady(DEFAULT_BRACKET.stages[1], seeds, outcomes)).toBe(true);
    expect(resolveSource("W:REPECHAJE:1", seeds, outcomes)).toBe("T12");
  });
  it("zonas por defecto: 1-4 directo y parejas de repechaje con el mismo color", () => {
    const zones = defaultZones(DEFAULT_BRACKET, 26);
    expect(zoneForPosition(zones, 1)?.positions).toEqual([1, 2, 3, 4]);
    expect(zoneForPosition(zones, 5)?.color).toBe(zoneForPosition(zones, 12)?.color);
    expect(zoneForPosition(zones, 8)?.color).toBe(zoneForPosition(zones, 9)?.color);
    expect(zoneForPosition(zones, 13)).toBeUndefined();
  });
  it("zonas se adaptan al número real de equipos", () => {
    const zones = defaultZones(DEFAULT_BRACKET, 10);
    expect(zoneForPosition(zones, 11)).toBeUndefined();
    expect(zoneForPosition(zones, 5)?.positions).toEqual([5]);
  });
});

describe("goleo", () => {
  const recs = [
    { playerId: "p1", playerName: "Rubén", teamId: "t1", teamName: "Venus", matchId: "m1", goals: 3 },
    { playerId: "p1", playerName: "Rubén", teamId: "t1", teamName: "Venus", matchId: "m2", goals: 2 },
    { playerId: "p2", playerName: "Osvani", teamId: "t2", teamName: "Imperium", matchId: "m3", goals: 5 },
    { playerId: "p3", playerName: "Diego", teamId: "t3", teamName: "Maravillas", matchId: "m4", goals: 1 },
    { playerId: "p3", playerName: "Diego", teamId: "t4", teamName: "Otro", matchId: "m5", goals: 1 },
  ];
  it("ordena de mayor a menor y comparte posición en empate", () => {
    const rows = computeScorers(recs);
    expect(rows.map((r) => r.goals)).toEqual([5, 5, 2]);
    expect(rows[0].position).toBe(1);
    expect(rows[1].position).toBe(1);
    expect(rows[2].position).toBe(3);
    expect(rows[2].teamLabel).toContain("/");
  });
  it("criterio de desempate configurable", () => {
    const rows = computeScorers(recs, ["MENOS_PARTIDOS_CON_GOL"]);
    expect(rows[0].playerName).toBe("Osvani");
    expect(rows[1].position).toBe(2);
  });
  it("valida goleadores contra el marcador", () => {
    expect(validateScorers([{ playerId: "p1", teamId: "A", goals: 3 }], "A", "B", 2, 0)).toHaveLength(1);
    expect(validateScorers([{ playerId: "p1", teamId: "A", goals: 2 }], "A", "B", 2, 0)).toHaveLength(0);
  });
});

describe("conflictos", () => {
  const ctx = (over: Partial<ConflictContext> = {}): ConflictContext => ({
    sameDateMatches: [
      { id: "x", date: "2026-10-11", timeSlotId: "ts1", fieldId: "f1", homeTeamId: "C", awayTeamId: "D" },
    ],
    fieldBlocks: [],
    teamRestrictions: [],
    teams: new Map([
      ["A", { name: "A", leagueId: "L1", active: true }],
      ["B", { name: "B", leagueId: "L1", active: true }],
      ["C", { name: "C", leagueId: "L1", active: true }],
      ["D", { name: "D", leagueId: "L1", active: true }],
      ["E", { name: "E", leagueId: "L2", active: true }],
    ]),
    fields: new Map([["f1", { name: "Cancha 1", active: true }], ["f2", { name: "Cancha 2", active: true }]]),
    timeSlots: new Map([["ts1", { startTime: "08:10", active: true }]]),
    allowInterLeague: false,
    previousMeetings: 0,
    ...over,
  });
  const base = { date: "2026-10-11", timeSlotId: "ts1", homeTeamId: "A", awayTeamId: "B", type: "OFICIAL" as const };
  it("detecta cancha ocupada y equipo simultáneo", () => {
    const r = checkMatchConflicts({ ...base, fieldId: "f1", awayTeamId: "C" }, ctx());
    expect(r.errors.some((e) => e.includes("ocupada"))).toBe(true);
    expect(r.errors.some((e) => e.includes("misma hora"))).toBe(true);
  });
  it("sin conflictos en espacio libre", () => {
    const r = checkMatchConflicts({ ...base, fieldId: "f2" }, ctx());
    expect(r.errors).toEqual([]);
  });
  it("partidos entre ligas requieren tipo extraordinario", () => {
    expect(checkMatchConflicts({ ...base, awayTeamId: "E", fieldId: "f2" }, ctx()).errors.length).toBe(1);
    const ok = checkMatchConflicts({ ...base, awayTeamId: "E", fieldId: "f2", type: "INTERLIGA" }, ctx());
    expect(ok.errors).toEqual([]);
    expect(ok.warnings.length).toBeGreaterThan(0);
  });
});

describe("sanciones", () => {
  it("sanción por partidos se cumple al registrar todos los partidos", () => {
    expect(sanctionProgress("PARTIDOS", 2, 1)).toEqual({ served: 1, remaining: 1, complete: false });
    expect(nextStatusAfterServing("ACTIVA", "PARTIDOS", 2, 2)).toBe("CUMPLIDA");
    expect(nextStatusAfterServing("CUMPLIDA", "PARTIDOS", 2, 1)).toBe("ACTIVA");
  });
  it("no convierte minutos en partidos", () => {
    expect(sanctionProgress("MINUTOS", 20, 3).remaining).toBeNull();
    expect(nextStatusAfterServing("ACTIVA", "MINUTOS", 20, 3)).toBe("ACTIVA");
  });
});

describe("texto", () => {
  it("normaliza nombres para detectar duplicados", () => {
    expect(normalizeName("  Huracán  fc ")).toBe(normalizeName("HURACAN FC"));
  });
});
