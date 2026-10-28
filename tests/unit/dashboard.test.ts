import { describe, expect, it } from "vitest";
import { getDashboardAction, type DashboardProgress } from "@/domain/dashboard";

const empty: DashboardProgress = {
  activeLeagues: 2, activeTeams: 0, hasMatches: false, hasDraft: false,
  pendingResult: 0, pendingResultDate: null, unscheduled: 0, played: 0,
  nextDate: null, today: "2026-10-28",
};

describe("siguiente acción en Inicio", () => {
  it("empieza por las ligas si no hay ninguna activa", () => {
    expect(getDashboardAction({ ...empty, activeLeagues: 0 }).href).toBe("/ligas");
  });

  it.each([0, 1])("con %i equipos activos dirige al registro, nunca a resultados", (activeTeams) => {
    expect(getDashboardAction({ ...empty, activeTeams })).toMatchObject({ href: "/equipos", label: "Registrar equipos" });
  });

  it("con participantes y sin partidos propone preparar el calendario", () => {
    expect(getDashboardAction({ ...empty, activeTeams: 4 })).toMatchObject({ href: "/calendario", label: "Preparar calendario" });
  });

  it("un borrador se revisa antes de intentar generar otro calendario", () => {
    expect(getDashboardAction({ ...empty, activeTeams: 4, hasDraft: true }).label).toBe("Revisar borrador");
  });

  it("prioriza el resultado atrasado más antiguo aun con borrador y partidos sin programar", () => {
    expect(getDashboardAction({ ...empty, hasMatches: true, hasDraft: true, unscheduled: 2, pendingResult: 3, pendingResultDate: "2026-10-11" })).toMatchObject({
      href: "/resultados?date=2026-10-11", label: "Registrar resultados",
    });
  });

  it("lleva a los encuentros pendientes de fecha, horario o cancha", () => {
    expect(getDashboardAction({ ...empty, hasMatches: true, unscheduled: 2 }).href).toBe("/partidos?estado=PENDIENTE");
  });

  it("permite capturar los resultados de hoy sin tratarlos como atrasados", () => {
    expect(getDashboardAction({ ...empty, hasMatches: true, nextDate: empty.today }).href).toBe("/resultados?date=2026-10-28");
  });

  it("los partidos manuales futuros abren la fecha correspondiente sin exigir un calendario generado", () => {
    expect(getDashboardAction({ ...empty, hasMatches: true, nextDate: "2026-11-01" }).href).toBe("/partidos?fecha=2026-11-01");
  });

  it("con resultados completos y sin próximas fechas muestra la clasificación", () => {
    expect(getDashboardAction({ ...empty, hasMatches: true, played: 5 }).href).toBe("/tabla");
  });

  it("una temporada con solo cancelados no anuncia resultados al día", () => {
    expect(getDashboardAction({ ...empty, hasMatches: true })).toMatchObject({ title: "Revisa la programación", href: "/calendario" });
  });
});
