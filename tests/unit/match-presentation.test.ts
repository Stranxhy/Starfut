import { describe, expect, it } from "vitest";
import { captureState, groupMatchesByDate, validMatchDate } from "@/domain/match-presentation";

const date = new Date("2026-10-25T00:00:00.000Z");

describe("consulta y captura de partidos", () => {
  it("rechaza fechas inválidas sin confundirlas con otro día", () => {
    for (const value of [undefined, "", "hola", "2026-02-29", "2026-04-31", "2026-13-01", "0000-01-01"]) {
      expect(validMatchDate(value)).toBeUndefined();
    }
    expect(validMatchDate("2028-02-29")).toBe("2028-02-29");
    expect(validMatchDate("2026-10-25")).toBe("2026-10-25");
  });
  it("solo ofrece captura para encuentros programados y sin resultado", () => {
    expect(captureState({ date, status: "PROGRAMADO", result: null })).toBe("pendientes");
    expect(captureState({ date, status: "REPROGRAMADO", result: null })).toBe("pendientes");
    expect(captureState({ date, status: "JUGADO", result: { homeGoals: 0, awayGoals: 0 } })).toBe("registrados");
    expect(captureState({ date, status: "PENDIENTE", result: null })).toBe("programar");
    expect(captureState({ date: null, status: "PROGRAMADO", result: null })).toBe("programar");
    expect(captureState({ date, status: "CANCELADO", result: null })).toBe("cancelados");
    expect(captureState({ date: null, status: "CANCELADO", result: {} })).toBe("cancelados");
  });
  it("agrupa sin mezclar fechas y conserva el orden de horario y cancha", () => {
    const matches = [{ id: "a", date }, { id: "b", date }, { id: "c", date: new Date("2026-11-01T00:00:00Z") }, { id: "d", date: null }];
    expect(groupMatchesByDate(matches).map(([day, items]) => [day, items.map((m) => m.id)])).toEqual([
      ["2026-10-25", ["a", "b"]], ["2026-11-01", ["c"]], [null, ["d"]],
    ]);
    expect(matches.map((m) => m.id)).toEqual(["a", "b", "c", "d"]);
  });
});
