import { describe, expect, it } from "vitest";
import { resolveScorersPeriod, scorersPdfHref } from "@/domain/scorers-view";

const rounds = [1, 2, 3];

describe("períodos de goleo", () => {
  it("distingue la fase regular del período con eliminatorias", () => {
    expect(resolveScorersPeriod({}, rounds)).toEqual({ period: "regular", round: undefined, includePlayoffs: false });
    expect(resolveScorersPeriod({ periodo: "completa" }, rounds)).toEqual({ period: "completa", round: undefined, includePlayoffs: true });
    expect(resolveScorersPeriod({ periodo: "jornada-2" }, rounds)).toEqual({ period: "jornada-2", round: 2, includePlayoffs: false });
  });
  it("conserva enlaces antiguos y hace explícito que un corte de jornada excluye eliminatorias", () => {
    expect(resolveScorersPeriod({ eliminatorias: "1" }, rounds).includePlayoffs).toBe(true);
    expect(resolveScorersPeriod({ jornada: "1", eliminatorias: "1" }, rounds)).toEqual({ period: "jornada-1", round: 1, includePlayoffs: false });
    expect(resolveScorersPeriod({ periodo: "regular", jornada: "2", eliminatorias: "1" }, rounds)).toEqual({ period: "regular", round: undefined, includePlayoffs: false });
  });
  it("no consulta jornadas inválidas o ajenas a la temporada", () => {
    for (const periodo of ["jornada-4", "jornada-0", "jornada--1", "jornada-1.5", "jornada-NaN", "jornada-99999999999999999", "desconocido"]) {
      expect(resolveScorersPeriod({ periodo }, rounds)).toEqual({ period: "regular", round: undefined, includePlayoffs: false });
    }
    expect(resolveScorersPeriod({ jornada: "xyz" }, rounds).round).toBeUndefined();
    expect(resolveScorersPeriod({ periodo: "jornada-1" }, []).round).toBeUndefined();
  });
  it("envía al PDF exactamente el período elegido, incluida la opción de eliminatorias", () => {
    expect(scorersPdfHref("liga-a", resolveScorersPeriod({ periodo: "completa" }, rounds))).toBe("/api/pdf/goleo?league=liga-a&playoffs=1");
    expect(scorersPdfHref("liga-a", resolveScorersPeriod({ periodo: "jornada-2" }, rounds))).toBe("/api/pdf/goleo?league=liga-a&round=2");
    expect(scorersPdfHref("liga-a", resolveScorersPeriod({}, rounds))).toBe("/api/pdf/goleo?league=liga-a");
  });
});
