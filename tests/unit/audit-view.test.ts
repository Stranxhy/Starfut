import { describe, expect, it } from "vitest";
import { AUDIT_WITHOUT_USER, auditActionLabel, auditChanges, auditDayBoundary, auditRecordHref, auditValue, auditWhere, resolveAuditView } from "@/domain/audit-view";

describe("periodos del historial", () => {
  it("abarca el día completo en Ciudad de México y excluye el día siguiente", () => {
    expect(auditDayBoundary("2026-10-28", false, "America/Mexico_City").toISOString()).toBe("2026-10-28T06:00:00.000Z");
    expect(auditDayBoundary("2026-10-28", true, "America/Mexico_City").toISOString()).toBe("2026-10-29T06:00:00.000Z");
  });
  it("respeta días de 23 y 25 horas cuando la zona configurada cambia de horario", () => {
    for (const [day, hours] of [["2026-03-08", 23], ["2026-11-01", 25]] as const) {
      const start = auditDayBoundary(day, false, "America/New_York");
      const end = auditDayBoundary(day, true, "America/New_York");
      expect((end.getTime() - start.getTime()) / 3_600_000).toBe(hours);
    }
  });
  it("maneja el año bisiesto y el cambio de año sin perder el último día", () => {
    expect(auditDayBoundary("2024-02-29", true, "UTC").toISOString()).toBe("2024-03-01T00:00:00.000Z");
    expect(auditDayBoundary("2026-12-31", true, "UTC").toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
  it("rechaza fechas inexistentes y rangos invertidos en vez de ampliar los resultados", () => {
    for (const query of [{ desde: "2026-02-30" }, { hasta: "incorrecta" }, { desde: "2026-10-29", hasta: "2026-10-28" }]) {
      const view = resolveAuditView(query);
      expect(view.dateError).toBeTruthy();
      expect(auditWhere(view)).toMatchObject({ id: { in: [] } });
    }
  });
  it("admite fechas abiertas, conserva los filtros y normaliza páginas inválidas", () => {
    const view = resolveAuditView({ q: "  cambio  ", entidad: "Equipo", accion: "EDITAR", usuario: AUDIT_WITHOUT_USER, desde: "2026-10-28", page: "-1" });
    expect(view).toMatchObject({ q: "cambio", requestedPage: 1, dateError: undefined });
    expect(auditWhere(view)).toMatchObject({ entity: "Equipo", action: "EDITAR", userId: null, createdAt: { gte: expect.any(Date) } });
    expect(auditWhere(view).createdAt).not.toHaveProperty("lt");
    expect(resolveAuditView({ page: "1.5" }).requestedPage).toBe(1);
  });
});

describe("comparación de valores registrados", () => {
  it("distingue campos ausentes, nulos, vacíos, cero y falso", () => {
    const changes = auditChanges({ nombre: "", activo: false, goles: 0, anterior: null }, { nombre: null, activo: false, goles: 0, nuevo: null });
    expect(changes.filter((row) => row.changed).map((row) => row.key)).toEqual(["nombre", "anterior", "nuevo"]);
    expect(changes.find((row) => row.key === "nuevo")).toMatchObject({ before: undefined, after: null });
    expect([undefined, null, "", 0, false].map(auditValue)).toEqual(["No registrado", "Sin valor", "Texto vacío", "0", "No"]);
  });
  it("ignora el orden de las claves de objetos pero conserva el orden de las listas", () => {
    const before = { reglas: { ganar: 3, perder: 0 }, cruces: [1, 2] };
    const after = { reglas: { perder: 0, ganar: 3 }, cruces: [2, 1] };
    expect(auditChanges(before, after).map((row) => [row.key, row.changed])).toEqual([["reglas", false], ["cruces", true]]);
    expect(JSON.parse(auditValue(after.reglas))).toEqual(after.reglas);
  });
  it("presenta altas, eliminaciones y listas importadas sin inventar la otra instantánea", () => {
    expect(auditChanges(null, { name: "Equipo nuevo" })).toEqual([{ key: "name", label: "Nombre", before: undefined, after: "Equipo nuevo", changed: true }]);
    expect(auditChanges(["A", "B"], null)[0]).toMatchObject({ before: ["A", "B"], after: undefined, changed: true });
    expect(auditChanges(null, false)[0]).toMatchObject({ after: false, changed: true });
    expect(auditChanges(null, null)).toEqual([]);
  });
  it("conserva campos desconocidos y los objetos anidados completos", () => {
    const value = { lista: [{ id: "jugador", goles: 2 }], notas: "Línea 1\nLínea 2" };
    const change = auditChanges(null, { nuevoCampo: value })[0];
    expect(change.label).toBe("Nuevo Campo");
    expect(JSON.parse(auditValue(change.after))).toEqual(value);
    expect(auditChanges(null, { constructor: "Valor registrado" })[0]).toMatchObject({ label: "Constructor", before: undefined, after: "Valor registrado", changed: true });
    expect(auditActionLabel("constructor")).toBe("constructor");
    expect(auditActionLabel("ACCION_FUTURA")).toBe("ACCION_FUTURA");
    expect(auditActionLabel("EDITAR")).toBe("Edición");
  });
});

describe("enlaces a registros", () => {
  it("solo enlaza tipos con ficha y nunca ofrece abrir una eliminación", () => {
    expect(auditRecordHref("Equipo", "id/1", "EDITAR")).toBe("/equipos/id%2F1");
    expect(auditRecordHref("Equipo", "id", "ELIMINAR")).toBeNull();
    expect(auditRecordHref("Equipo", null, "CREAR")).toBeNull();
    expect(auditRecordHref("Catálogo", "id", "CONFIGURACION")).toBeNull();
  });
});
