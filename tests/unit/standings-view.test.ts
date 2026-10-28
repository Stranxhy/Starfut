import { describe, expect, it } from "vitest";
import { resolveStandingsView } from "@/domain/standings-view";

const rounds = [1, 2, 3];

describe("selección de tabla general", () => {
  it("muestra el cierre por defecto solo cuando existe", () => {
    expect(resolveStandingsView({}, rounds, true)).toEqual({ view: "final", round: undefined });
    expect(resolveStandingsView({}, rounds, false)).toEqual({ view: "actual", round: undefined });
    expect(resolveStandingsView({ vista: "final" }, rounds, false).view).toBe("actual");
  });
  it("permite consultar el cálculo actual después del cierre", () => {
    expect(resolveStandingsView({ vista: "actual" }, rounds, true)).toEqual({ view: "actual", round: undefined });
  });
  it("una jornada histórica consulta resultados aunque la URL solicite el cierre", () => {
    expect(resolveStandingsView({ vista: "final", jornada: "2" }, rounds, true)).toEqual({ view: "actual", round: 2 });
  });
  it("ignora jornadas inválidas o ajenas a la temporada antes de consultar la base", () => {
    for (const jornada of ["", "abc", "0", "-1", "1.5", "999999999999999999999", "4"]) {
      expect(resolveStandingsView({ vista: "actual", jornada }, rounds, true)).toEqual({ view: "actual", round: undefined });
    }
    expect(resolveStandingsView({ jornada: "1" }, [], false).round).toBeUndefined();
  });
});
