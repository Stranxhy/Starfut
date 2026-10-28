import { describe, expect, it } from "vitest";
import { playerGoalSummary, resolvePlayersView } from "@/domain/players-view";
import { directoryPage, removeFilter } from "@/domain/filters";

const teams = [{ id: "a", leagueId: "premium", active: true }, { id: "b", leagueId: "premium", active: false }, { id: "c", leagueId: "juvenil", active: true }];
const leagues = ["premium", "juvenil"];

describe("directorio de jugadores", () => {
  it("conserva equipo y liga válidos y preselecciona el equipo activo para el alta", () => {
    expect(resolvePlayersView({ equipo: "a", liga: "premium", q: "  José  " }, leagues, teams)).toEqual({ q: "José", liga: "premium", equipo: "a", defaultTeamId: "a", estado: "activos", orden: "name-asc", sort: "name", dir: "asc", requestedPage: 1 });
  });
  it("permite consultar jugadores de un equipo dado de baja sin proponerlo en un alta nueva", () => {
    expect(resolvePlayersView({ equipo: "b", estado: "todos" }, leagues, teams)).toMatchObject({ equipo: "b", estado: "todos", defaultTeamId: undefined });
    expect(resolvePlayersView({ estado: "inactivos" }, leagues, teams).estado).toBe("inactivos");
  });
  it("descarta un equipo incompatible al cambiar de liga y selecciones ajenas a la temporada", () => {
    expect(resolvePlayersView({ equipo: "a", liga: "juvenil" }, leagues, teams)).toMatchObject({ liga: "juvenil", equipo: "", defaultTeamId: undefined });
    expect(resolvePlayersView({ equipo: "otra-temporada", liga: "otra-liga", estado: "inválido" }, leagues, teams)).toMatchObject({ liga: "", equipo: "", estado: "activos" });
  });
  it("conserva enlaces antiguos de orden y prioriza el selector nuevo", () => {
    expect(resolvePlayersView({ sort: "number", dir: "desc" }, leagues, teams)).toMatchObject({ orden: "number-desc", sort: "number", dir: "desc" });
    expect(resolvePlayersView({ sort: "number", dir: "desc", orden: "team-asc" }, leagues, teams)).toMatchObject({ orden: "team-asc", sort: "team", dir: "asc" });
    expect(resolvePlayersView({ sort: "otro", dir: "otro", orden: "otro" }, leagues, teams).orden).toBe("name-asc");
  });
  it("quitar el estado conserva la selección y reinicia la página", () => {
    const url = new URL(removeFilter("/jugadores", { q: "José", liga: "premium", equipo: "b", estado: "inactivos", orden: "number-desc", page: 4 }, "estado", "todos"), "http://test");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "José", liga: "premium", equipo: "b", estado: "todos", orden: "number-desc" });
  });
  it("normaliza páginas inválidas y ajusta el directorio después de cambiar filtros", () => {
    for (const page of ["-1", "0", "2.5", "3foo", "Infinity", "9007199254740992"]) expect(resolvePlayersView({ page }, leagues, teams).requestedPage).toBe(1);
    expect(directoryPage(5, 26, 25)).toEqual({ page: 2, pageCount: 2, skip: 25 });
    expect(directoryPage(5, 0, 25)).toEqual({ page: 1, pageCount: 1, skip: 0 });
  });
});

const entry = (id: string, type: string, status: string, goals: number, day: string | null = "2026-08-02", matchId = id) => ({ id, matchId, goals, teamId: id, match: { type, status, date: day ? new Date(`${day}T00:00:00Z`) : null } });

describe("resumen de goles del jugador", () => {
  it("suma competencia de varios equipos y separa amistosos, sin incluir partidos pendientes o cancelados", () => {
    const rows = [entry("anterior", "OFICIAL", "JUGADO", 2), entry("actual", "ELIMINATORIA", "JUGADO", 3), entry("amistoso", "AMISTOSO", "JUGADO", 4), entry("cancelado", "OFICIAL", "CANCELADO", 9), entry("pendiente", "OFICIAL", "PENDIENTE", 8)];
    const summary = playerGoalSummary(rows);
    expect(summary).toMatchObject({ competitionGoals: 5, friendlyGoals: 4, matchesWithGoal: 2 });
    expect(summary.played.map((row) => row.teamId).sort()).toEqual(["actual", "amistoso", "anterior"]);
  });
  it("cuenta partidos distintos con goles positivos e incluye interliga y sustitución", () => {
    const summary = playerGoalSummary([entry("a", "INTERLIGA", "JUGADO", 2, null, "m1"), entry("b", "INTERLIGA", "JUGADO", 1, null, "m1"), entry("c", "SUSTITUCION", "JUGADO", 1, null, "m2"), entry("d", "OFICIAL", "JUGADO", 0, null, "m3")]);
    expect(summary).toMatchObject({ competitionGoals: 4, friendlyGoals: 0, matchesWithGoal: 2 });
  });
  it("ordena el historial más reciente primero sin modificar los registros y admite un historial vacío", () => {
    const rows = [entry("a", "OFICIAL", "JUGADO", 1, "2026-08-02"), entry("b", "OFICIAL", "JUGADO", 2, "2026-08-09"), entry("c", "OFICIAL", "JUGADO", 1, null)];
    expect(playerGoalSummary(rows).played.map((row) => row.id)).toEqual(["b", "a", "c"]);
    expect(rows.map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(playerGoalSummary([])).toEqual({ played: [], competitionGoals: 0, friendlyGoals: 0, matchesWithGoal: 0 });
  });
});
