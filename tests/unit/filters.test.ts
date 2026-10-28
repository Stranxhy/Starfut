import { describe, expect, it } from "vitest";
import { removeFilter } from "@/domain/filters";

describe("quitar filtros sin perder la búsqueda", () => {
  it("conserva el nombre y orden, elimina la liga y reinicia la página", () => {
    const url = new URL(removeFilter("/equipos", { q: "Águilas & Sol", liga: "a", sort: "name", dir: "desc", page: 4 }, "liga"), "http://test");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "Águilas & Sol", sort: "name", dir: "desc" });
  });
  it("quitar el estado Activos selecciona Todos en vez de volver al filtro por defecto", () => {
    expect(removeFilter("/jugadores", { estado: "activos", equipo: "uno", page: 2 }, "estado", "todos")).toBe("/jugadores?estado=todos&equipo=uno");
  });
  it("quitar el último filtro devuelve la ruta limpia", () => {
    expect(removeFilter("/sanciones", { tipo: "1", q: "", page: 3 }, "tipo")).toBe("/sanciones");
  });
});
