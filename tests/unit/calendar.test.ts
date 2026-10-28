import { describe, expect, it } from "vitest";
import { calendarWeeks, roundMatchesHref, roundSummary, shiftCalendarMonth, upcomingRound, validCalendarMonth, type CalendarRound } from "../../src/domain/calendar";

const round = (id: string, date: string, statuses: string[]): CalendarRound => ({ id, date, number: 1, phase: "REGULAR", name: null, locked: true, matches: statuses.map((status) => ({ status, date })) });

describe("consulta del calendario", () => {
  it("separa partidos cancelados, disputados, sin espacio y movidos de fecha", () => {
    const item = round("j1", "2026-10-25", ["JUGADO", "PROGRAMADO", "PENDIENTE", "CANCELADO"]);
    item.matches[1].date = "2026-11-01";
    item.matches[3].date = "2026-11-08";
    expect(roundSummary(item)).toEqual({ active: 3, played: 1, remaining: 2, cancelled: 1, moved: 1, unassigned: 1 });
    expect(roundMatchesHref(item)).toBe("/partidos?jornada=1");
  });
  it("busca la próxima jornada con encuentros por disputar, incluyendo hoy", () => {
    const rounds = [round("later", "2026-11-08", ["PROGRAMADO"]), round("past", "2026-10-18", ["PROGRAMADO"]), round("done", "2026-10-25", ["JUGADO", "CANCELADO"]), round("empty", "2026-10-25", []), round("today", "2026-10-25", ["PENDIENTE"])];
    expect(upcomingRound(rounds, "2026-10-25")?.id).toBe("today");
    expect(upcomingRound(rounds, "2026-11-09")).toBeUndefined();
    expect(rounds[0].id).toBe("later");
  });
  it("organiza semanas de lunes a domingo y conserva el 29 de febrero", () => {
    const leap = calendarWeeks("2024-02");
    expect(leap[0]).toEqual([null, null, null, "2024-02-01", "2024-02-02", "2024-02-03", "2024-02-04"]);
    expect(leap.flat().filter(Boolean)).toHaveLength(29);
    expect(leap.at(-1)?.[3]).toBe("2024-02-29");
    expect(calendarWeeks("2021-02")).toHaveLength(4);
    expect(calendarWeeks("2021-05")).toHaveLength(6);
  });
  it("cambia de año al navegar meses y rechaza parámetros inválidos", () => {
    expect(shiftCalendarMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftCalendarMonth("2026-01", -1)).toBe("2025-12");
    expect(validCalendarMonth("2026-13")).toBe(false);
    expect(validCalendarMonth("0000-01")).toBe(false);
    expect(validCalendarMonth("2026-1")).toBe(false);
    expect(() => calendarWeeks("invalid")).toThrow("Mes inválido");
  });
});
