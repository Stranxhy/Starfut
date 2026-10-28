import { describe, expect, it } from "vitest";
import { resolveTeamsView, teamDirectoryPage } from "@/domain/teams-view";
import { removeFilter } from "@/domain/filters";

const leagues = ["premium", "juvenil"];

describe("directorio de equipos", () => {
  it("abre los activos por nombre y conserva la liga desde la que se registra un equipo", () => {
    const view = resolveTeamsView({ liga: "juvenil", q: "  Águilas  " }, leagues);
    expect(view).toEqual({ q: "Águilas", liga: "juvenil", estado: "activos", orden: "name-asc", sort: "name", dir: "asc", requestedPage: 1 });
  });

  it("admite dados de baja y todos, sin dejar estados o ligas que el formulario no puede mostrar", () => {
    expect(resolveTeamsView({ estado: "inactivos" }, leagues).estado).toBe("inactivos");
    expect(resolveTeamsView({ estado: "todos" }, leagues).estado).toBe("todos");
    expect(resolveTeamsView({ estado: "desconocido", liga: "otra-temporada" }, leagues)).toMatchObject({ estado: "activos", liga: "" });
  });

  it("conserva enlaces antiguos de orden y prioriza la selección nueva", () => {
    expect(resolveTeamsView({ sort: "league", dir: "desc" }, leagues)).toMatchObject({ orden: "league-desc", sort: "league", dir: "desc" });
    expect(resolveTeamsView({ sort: "name", dir: "asc", orden: "created-desc" }, leagues)).toMatchObject({ orden: "created-desc", sort: "created", dir: "desc" });
    expect(resolveTeamsView({ sort: "unknown", dir: "other", orden: "no-existe" }, leagues)).toMatchObject({ orden: "name-asc", sort: "name", dir: "asc" });
  });

  it("quitar Estado conserva liga, nombre y orden y permite consultar activos y bajas", () => {
    const view = resolveTeamsView({ q: "Águilas", liga: "premium", estado: "activos", orden: "created-desc", page: "3" }, leagues);
    const url = new URL(removeFilter("/equipos", { q: view.q, liga: view.liga, estado: view.estado, orden: view.orden, page: 3 }, "estado", "todos"), "http://test");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "Águilas", liga: "premium", estado: "todos", orden: "created-desc" });
  });

  it("rechaza páginas inválidas antes de calcular el desplazamiento de base de datos", () => {
    for (const page of ["-1", "0", "2.5", "Infinity", "2foo", "9007199254740992"]) {
      expect(resolveTeamsView({ page }, leagues).requestedPage).toBe(1);
    }
  });

  it("mantiene la última página disponible al cambiar filtros o dar de baja un equipo", () => {
    expect(teamDirectoryPage(2, 26, 25)).toEqual({ page: 2, pageCount: 2, skip: 25 });
    expect(teamDirectoryPage(2, 25, 25)).toEqual({ page: 1, pageCount: 1, skip: 0 });
    expect(teamDirectoryPage(Number.MAX_SAFE_INTEGER, 51, 25)).toEqual({ page: 3, pageCount: 3, skip: 50 });
    expect(teamDirectoryPage(4, 0, 25)).toEqual({ page: 1, pageCount: 1, skip: 0 });
  });
});
