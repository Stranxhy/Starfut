import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AUDIT_WITHOUT_USER, auditDayBoundary, resolveAuditView } from "@/domain/audit-view";
import { loadAuditHistory } from "@/server/services/audit-history";

const tag = `historial-${randomUUID()}`;
let userId: string;
const id = (suffix: string) => `${tag}-${suffix}`;

beforeAll(async () => {
  const user = await prisma.user.create({ data: { email: `${tag}@test.local`, name: "Prueba de historial", passwordHash: "prueba" } });
  userId = user.id;
  const start = auditDayBoundary("2026-10-28").getTime();
  const end = auditDayBoundary("2026-10-28", true).getTime();
  await prisma.auditLog.createMany({ data: [
    { id: id("previo"), userId, entity: "Equipo", action: "EDITAR", summary: tag, createdAt: new Date(start - 1) },
    { id: id("inicio"), userId, entity: "Equipo", action: "EDITAR", summary: tag, createdAt: new Date(start), before: { nombre: "Original", activo: false }, after: { nombre: "Nuevo", activo: false } },
    { id: id("fin"), userId, entity: "Equipo", action: "EDITAR", summary: "Cambio de nombre", reason: `${tag} motivo`, createdAt: new Date(end - 1) },
    { id: id("siguiente"), userId, entity: "Equipo", action: "EDITAR", summary: tag, createdAt: new Date(end) },
    { id: id("sistema"), entity: "Jugador", action: "CREAR", summary: tag, createdAt: new Date(start + 1000) },
    { id: id("otra-entidad"), userId, entity: "Liga", action: "EDITAR", summary: tag, createdAt: new Date(start + 2000) },
    ...Array.from({ length: 41 }, (_, index) => ({ id: id(`pagina-${String(index).padStart(2, "0")}`), userId, entity: "Equipo", action: "EDITAR", summary: `${tag}-paginado`, createdAt: new Date("2026-10-01T18:00:00Z") })),
  ] });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { id: { startsWith: tag } } });
  if (userId) await prisma.user.delete({ where: { id: userId } });
});

describe("consulta de actividad", () => {
  it("combina usuario, acción, tipo y días locales; busca también en el motivo", async () => {
    const result = await loadAuditHistory(resolveAuditView({ q: tag.toUpperCase(), entidad: "Equipo", accion: "EDITAR", usuario: userId, desde: "2026-10-28", hasta: "2026-10-28" }));
    expect(result.total).toBe(2);
    expect(result.logs.map((log) => log.id)).toEqual([id("fin"), id("inicio")]);
    expect(result.logs[1]).toMatchObject({ before: { nombre: "Original", activo: false }, after: { nombre: "Nuevo", activo: false }, user: { name: "Prueba de historial" } });
  });
  it("permite consultar acciones sin usuario asociado", async () => {
    const result = await loadAuditHistory(resolveAuditView({ q: tag, usuario: AUDIT_WITHOUT_USER }));
    expect(result.logs.map((log) => log.id)).toEqual([id("sistema")]);
    expect(result.logs[0].user).toBeNull();
  });
  it("deja vacía una consulta con fechas inválidas", async () => {
    const result = await loadAuditHistory(resolveAuditView({ q: tag, desde: "2026-02-30" }));
    expect(result).toMatchObject({ logs: [], total: 0, page: 1, pageCount: 1 });
  });
  it("ajusta páginas inexistentes y no repite eventos con la misma fecha", async () => {
    const first = await loadAuditHistory(resolveAuditView({ q: `${tag}-paginado` }));
    const last = await loadAuditHistory(resolveAuditView({ q: `${tag}-paginado`, page: "999" }));
    expect(first).toMatchObject({ total: 41, page: 1, pageCount: 2 });
    expect(first.logs).toHaveLength(40);
    expect(last).toMatchObject({ total: 41, page: 2, pageCount: 2 });
    expect(last.logs.map((log) => log.id)).toEqual([id("pagina-00")]);
    expect(new Set([...first.logs, ...last.logs].map((log) => log.id)).size).toBe(41);
  });
});
