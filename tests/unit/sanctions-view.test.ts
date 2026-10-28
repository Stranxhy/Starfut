import { describe, expect, it } from "vitest";
import { resolveSanctionsView, sanctionFollowUp, sanctionsPdfHref, sanctionsWhere, validSanctionDate } from "@/domain/sanctions-view";
import { directoryPage, removeFilter } from "@/domain/filters";
import { nextStatusAfterServing } from "@/domain/sanctions";

const leagues = ["liga-a", "liga-b"];
const teams = [{ id: "equipo-a", leagueId: "liga-a" }, { id: "equipo-b", leagueId: "liga-b" }];
const resolve = (query: Record<string, string | undefined>) => resolveSanctionsView(query, leagues, teams, ["tipo-activo", "tipo-archivado"]);

describe("filtros de sanciones", () => {
  it("reconoce fechas reales y años bisiestos sin aceptar días que desbordan el mes", () => {
    expect(validSanctionDate("2028-02-29")).toBe(true);
    for (const value of ["2026-02-29", "2026-02-31", "2026-04-31", "2026-13-01", "0000-01-01", "28/10/2026", ""]) expect(validSanctionDate(value)).toBe(false);
  });
  it("permite consultar tipos archivados y valida el equipo contra la liga seleccionada", () => {
    expect(resolve({ tipo: "tipo-archivado", equipo: "equipo-a", liga: "liga-a", estado: "EN_REVISION" })).toMatchObject({ tipo: "tipo-archivado", equipo: "equipo-a", liga: "liga-a", estado: "EN_REVISION" });
    expect(resolve({ equipo: "equipo-a", liga: "liga-b" }).equipo).toBe("");
    expect(resolve({ liga: "otra-temporada", equipo: "otro-equipo", tipo: "otro-tipo", estado: "toString" })).toMatchObject({ liga: "", equipo: "", tipo: "", estado: "" });
  });
  it("no amplía silenciosamente la consulta ni permite exportar un periodo inválido", () => {
    for (const query of [{ desde: "2026-02-31" }, { desde: "2026-08-09", hasta: "2026-08-02" }]) {
      const view = resolve(query);
      expect(view.dateError).toBeTruthy();
      expect(sanctionsWhere("temporada", view)).toMatchObject({ seasonId: "temporada", id: { in: [] } });
      expect(sanctionsPdfHref("temporada", view)).toBeNull();
    }
  });
  it("incluye el nombre y los límites del periodo en la consulta y el PDF, sin paginar la exportación", () => {
    const view = resolve({ q: "  José Pérez  ", liga: "liga-a", equipo: "equipo-a", estado: "ACTIVA", tipo: "tipo-activo", desde: "2026-08-02", hasta: "2026-08-09", page: "3" });
    expect(sanctionsWhere("temporada", view)).toEqual({ seasonId: "temporada", teamId: "equipo-a", team: { leagueId: "liga-a" }, status: "ACTIVA", typeId: "tipo-activo", player: { nameKey: { contains: "JOSE PEREZ" } }, date: { gte: new Date("2026-08-02T00:00:00Z"), lte: new Date("2026-08-09T00:00:00Z") } });
    const params = new URL(sanctionsPdfHref("temporada", view)!, "http://test").searchParams;
    expect(Object.fromEntries(params)).toEqual({ season: "temporada", q: "José Pérez", league: "liga-a", team: "equipo-a", status: "ACTIVA", type: "tipo-activo", from: "2026-08-02", to: "2026-08-09" });
  });
  it("normaliza la paginación y conserva los demás filtros al quitar uno", () => {
    for (const page of ["-1", "0", "2.5", "Infinity", "9007199254740992"]) expect(resolve({ page }).requestedPage).toBe(1);
    expect(directoryPage(resolve({ page: "9" }).requestedPage, 26, 25)).toEqual({ page: 2, pageCount: 2, skip: 25 });
    expect(removeFilter("/sanciones", { q: "José", estado: "ACTIVA", equipo: "equipo-a", page: 2 }, "estado")).toBe("/sanciones?q=Jos%C3%A9&equipo=equipo-a");
  });
});

describe("seguimiento visible de sanciones", () => {
  it("muestra partidos pendientes y limita la barra sin alterar el total registrado", () => {
    expect(sanctionFollowUp("PARTIDOS", 3, 1, "ACTIVA")).toMatchObject({ served: 1, remaining: 2, complete: false, canRegister: true });
    expect(sanctionFollowUp("PARTIDOS", 2, 3, "CUMPLIDA")).toMatchObject({ served: 3, remaining: 0, percent: 100, canRegister: false });
    expect(sanctionFollowUp("PARTIDOS", 0, 0, "ACTIVA")).toMatchObject({ remaining: 0, percent: null, canRegister: false });
  });
  it("nunca confunde una barra completa con la aprobación de un caso en revisión o cancelado", () => {
    expect(sanctionFollowUp("PARTIDOS", 2, 2, "EN_REVISION").guidance).toContain("En revisión");
    expect(nextStatusAfterServing("EN_REVISION", "PARTIDOS", 2, 2)).toBe("EN_REVISION");
    expect(sanctionFollowUp("PARTIDOS", 2, 1, "CANCELADA")).toMatchObject({ canRegister: false, remaining: 1 });
    expect(nextStatusAfterServing("CANCELADA", "PARTIDOS", 2, 1)).toBe("CANCELADA");
  });
  it("conserva el seguimiento manual de días, minutos y otras unidades", () => {
    for (const kind of ["DIAS", "MINUTOS", "OTRA"] as const) {
      expect(sanctionFollowUp(kind, 2, 8, "ACTIVA")).toMatchObject({ served: 8, remaining: null, complete: false, percent: null, canRegister: true });
      expect(nextStatusAfterServing("ACTIVA", kind, 2, 8)).toBe("ACTIVA");
      expect(sanctionFollowUp(kind, 2, 8, "CANCELADA").canRegister).toBe(false);
    }
  });
});
