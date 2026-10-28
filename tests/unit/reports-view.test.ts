import { describe, expect, it } from "vitest";
import { quickReportHref, resolveReportDates } from "@/domain/reports-view";

const days = { all: ["2026-10-18", "2026-10-25", "2026-11-01"], rolDate: "2026-11-01", resultsDate: "2026-10-25" };

describe("fechas de reportes", () => {
  it("conserva las fechas elegidas de manera independiente", () => {
    expect(resolveReportDates({ rol: "2026-10-25", resultados: "2026-10-18" }, days, "2026-10-28")).toMatchObject({ rolDate: "2026-10-25", resultsDate: "2026-10-18", resultDates: ["2026-10-18", "2026-10-25"] });
  });
  it("descarta fechas ajenas y resultados futuros que no están disponibles en el selector", () => {
    expect(resolveReportDates({ rol: "2027-01-01", resultados: "2026-11-01" }, days, "2026-10-28")).toMatchObject({ rolDate: "2026-11-01", resultsDate: "2026-10-25" });
  });
  it("conserva una fecha futura si ya fue identificada como la última fecha disputada", () => {
    expect(resolveReportDates({}, { ...days, resultsDate: "2026-11-01" }, "2026-10-28")).toMatchObject({ resultsDate: "2026-11-01", resultDates: days.all });
  });
  it("no elige una fecha de resultados cuando solo hay programación futura ni inventa fechas sin calendario", () => {
    expect(resolveReportDates({}, { all: ["2026-11-01"], rolDate: "2026-11-01", resultsDate: null }, "2026-10-28")).toMatchObject({ rolDate: "2026-11-01", resultsDate: null, resultDates: [] });
    expect(resolveReportDates({}, { all: [], rolDate: null, resultsDate: null }, "2026-10-28")).toEqual({ rolDates: [], resultDates: [], rolDate: null, resultsDate: null });
  });
});

describe("enlaces a documentos de jornada", () => {
  it("fija temporada, liga y fecha en ambas acciones y codifica los identificadores", () => {
    for (const doc of ["rol", "resultados"] as const) {
      const open = new URL(quickReportHref(doc, "temporada & 1", "liga/2", "2026-10-25")!, "http://test");
      expect(open.pathname).toBe(`/api/pdf/${doc}`);
      expect(Object.fromEntries(open.searchParams)).toEqual({ season: "temporada & 1", league: "liga/2", date: "2026-10-25" });
      const download = new URL(quickReportHref(doc, "temporada & 1", "liga/2", "2026-10-25", true)!, "http://test");
      expect(Object.fromEntries(download.searchParams)).toEqual({ ...Object.fromEntries(open.searchParams), download: "1" });
    }
  });
  it("mantiene tabla y goleo acumulados independientes de la fecha del rol", () => {
    for (const doc of ["tabla-general", "goleo"] as const) {
      const url = new URL(quickReportHref(doc, "temporada", "liga", "2026-10-25")!, "http://test");
      expect(Object.fromEntries(url.searchParams)).toEqual({ season: "temporada", league: "liga" });
    }
  });
  it("no produce enlaces a documentos diarios sin fecha ni documentos sin temporada o liga", () => {
    expect(quickReportHref("rol", "temporada", "liga", null)).toBeNull();
    expect(quickReportHref("resultados", "temporada", "liga", null)).toBeNull();
    expect(quickReportHref("tabla-general", "", "liga", null)).toBeNull();
    expect(quickReportHref("goleo", "temporada", "", null)).toBeNull();
  });
});
