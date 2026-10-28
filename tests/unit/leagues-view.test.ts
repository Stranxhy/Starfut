import { describe, expect, it } from "vitest";
import { filterLeagues, leagueRoundHref, leagueStandingPosition, resolveLeagueFilters } from "@/domain/leagues-view";

const leagues = [
  { id: "b", name: "Élite Femenil", active: true },
  { id: "a", name: "Primera División", active: false },
  { id: "c", name: "Élite Juvenil", active: false },
];

describe("consulta de ligas", () => {
  it("busca sin distinguir acentos o mayúsculas y conserva el orden de presentación", () => {
    const filters = resolveLeagueFilters({ q: "  elite  " });
    expect(filters.q).toBe("elite");
    expect(filterLeagues(leagues, filters).map((league) => league.id)).toEqual(["b", "c"]);
    expect(filterLeagues(leagues, resolveLeagueFilters({ q: "división" })).map((league) => league.id)).toEqual(["a"]);
    expect(leagues.map((league) => league.id)).toEqual(["b", "a", "c"]);
  });

  it("combina el nombre con el estado sin ocultar las inactivas por defecto", () => {
    expect(filterLeagues(leagues, resolveLeagueFilters({}))).toEqual(leagues);
    expect(filterLeagues(leagues, resolveLeagueFilters({ q: "elite", estado: "inactivas" })).map((league) => league.id)).toEqual(["c"]);
    expect(filterLeagues(leagues, resolveLeagueFilters({ estado: "activas" })).map((league) => league.id)).toEqual(["b"]);
    expect(filterLeagues(leagues, resolveLeagueFilters({ q: "primera", estado: "activas" }))).toEqual([]);
  });

  it("restablece estados desconocidos y admite listas o búsquedas vacías", () => {
    expect(resolveLeagueFilters({ estado: "eliminadas" })).toEqual({ q: "", estado: "" });
    expect(filterLeagues(leagues, resolveLeagueFilters({ q: "   " }))).toEqual(leagues);
    expect(filterLeagues([], resolveLeagueFilters({}))).toEqual([]);
    expect(filterLeagues(leagues, resolveLeagueFilters({ q: "Sin coincidencias" }))).toEqual([]);
  });
});

describe("navegación desde el detalle de liga", () => {
  it("abre toda la jornada regular, incluidos partidos reprogramados a otra fecha", () => {
    const url = new URL(leagueRoundHref("liga-a", { phase: "REGULAR", number: 4 }), "http://test");
    expect(url.pathname).toBe("/partidos");
    expect(Object.fromEntries(url.searchParams)).toEqual({ jornada: "4", liga: "liga-a" });
  });

  it("abre el cuadro de la liga para una eliminatoria sin confundirla con una jornada regular", () => {
    const url = new URL(leagueRoundHref("liga & a", { phase: "ELIMINATORIA", number: 4 }), "http://test");
    expect(url.pathname).toBe("/eliminatorias");
    expect(Object.fromEntries(url.searchParams)).toEqual({ liga: "liga & a" });
  });
});

describe("posiciones del resumen de liga", () => {
  it("no presenta el orden alfabético sin resultados ni un empate pendiente como posición definitiva", () => {
    expect(leagueStandingPosition({ position: 1, unresolvedTieGroup: null }, false)).toBe("Sin resultados");
    expect(leagueStandingPosition({ position: 1, unresolvedTieGroup: 0 }, true)).toBe("Por desempatar");
    expect(leagueStandingPosition({ position: 4, unresolvedTieGroup: 2 }, true)).toBe("Por desempatar");
  });

  it("muestra posiciones resueltas, incluido el cierre oficial, y equipos fuera de la tabla", () => {
    expect(leagueStandingPosition({ position: 3, unresolvedTieGroup: null }, true)).toBe("3.º");
    expect(leagueStandingPosition(undefined, true)).toBe("Sin posición");
  });
});
