import type { Prisma } from "@prisma/client";
import { APP_TIMEZONE } from "@/lib/dates";
import { AUDIT_ACTION } from "@/lib/labels";

export const AUDIT_WITHOUT_USER = "sin-usuario";
export const AUDIT_USER_FALLBACK = "Sistema / usuario no disponible";

function validDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function resolveAuditView(query: Record<string, string | undefined>) {
  const desde = validDate(query.desde) ? query.desde! : "";
  const hasta = validDate(query.hasta) ? query.hasta! : "";
  const dateError = (query.desde && !desde) || (query.hasta && !hasta)
    ? "Indica un día válido en Desde y Hasta."
    : desde && hasta && desde > hasta ? "La fecha Desde debe ser anterior o igual a Hasta." : undefined;
  const requestedPage = Number(query.page);
  return {
    q: query.q?.trim() ?? "", entidad: query.entidad?.trim() ?? "",
    accion: query.accion?.trim() ?? "", usuario: query.usuario?.trim() ?? "",
    desde, hasta, dateError,
    requestedPage: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  };
}

export type AuditView = ReturnType<typeof resolveAuditView>;

/** Primer instante del día local. Buscar por fecha evita asumir días de 24 h en cambios de horario. */
export function auditDayBoundary(iso: string, nextDay = false, timeZone = APP_TIMEZONE): Date {
  if (!validDate(iso)) throw new Error("Fecha de historial inválida");
  const target = new Date(`${iso}T00:00:00Z`);
  if (nextDay) target.setUTCDate(target.getUTCDate() + 1);
  const stamp = target.getTime();
  const formatter = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", era: "short" });
  // Todos los husos horarios quedan dentro de este margen de 36 horas.
  let low = stamp - 36 * 3_600_000;
  let high = stamp + 36 * 3_600_000;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const parts = Object.fromEntries(formatter.formatToParts(new Date(mid)).map((part) => [part.type, part.value]));
    const local = new Date(0);
    const year = Number(parts.year);
    local.setUTCFullYear(parts.era === "BC" ? 1 - year : year, Number(parts.month) - 1, Number(parts.day));
    if (local.getTime() < stamp) low = mid + 1;
    else high = mid;
  }
  return new Date(low);
}

export function auditWhere(view: AuditView): Prisma.AuditLogWhereInput {
  return {
    ...(view.entidad ? { entity: view.entidad } : {}),
    ...(view.accion ? { action: view.accion } : {}),
    ...(view.usuario ? { userId: view.usuario === AUDIT_WITHOUT_USER ? null : view.usuario } : {}),
    ...(view.q ? { OR: [{ summary: { contains: view.q, mode: "insensitive" } }, { reason: { contains: view.q, mode: "insensitive" } }] } : {}),
    ...(view.dateError ? { id: { in: [] } } : view.desde || view.hasta ? { createdAt: {
      ...(view.desde ? { gte: auditDayBoundary(view.desde) } : {}),
      ...(view.hasta ? { lt: auditDayBoundary(view.hasta, true) } : {}),
    } } : {}),
  };
}

const ENTITY_PATH: Record<string, string> = { Partido: "/partidos/", Equipo: "/equipos/", Jugador: "/jugadores/", "Sanción": "/sanciones/", Liga: "/ligas/" };

export function auditRecordHref(entity: string, id: string | null, action: string) {
  return id && Object.hasOwn(ENTITY_PATH, entity) && action !== "ELIMINAR" ? `${ENTITY_PATH[entity]}${encodeURIComponent(id)}` : null;
}

export function auditEntityLabel(entity: string) {
  return entity === "RestriccionEquipo" ? "Disponibilidad de equipo" : entity;
}

export function auditActionLabel(action: string) {
  return Object.hasOwn(AUDIT_ACTION, action) ? AUDIT_ACTION[action] : action;
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nombre", nombre: "Nombre", fullName: "Nombre completo", active: "Activo", activo: "Activo",
  leagueId: "ID de liga", teamId: "ID de equipo", playerId: "ID de jugador", matchId: "ID de partido", seasonId: "ID de temporada",
  contactName: "Contacto", contacto: "Contacto", contactPhone: "Teléfono", telefono: "Teléfono", contactEmail: "Correo", correo: "Correo",
  jerseyNumber: "Número de camiseta", birthDate: "Fecha de nacimiento", registrationNumber: "Número de registro",
  date: "Fecha", fecha: "Fecha", status: "Estado", estado: "Estado", reason: "Motivo", motivo: "Motivo", notes: "Observaciones",
  duration: "Duración", duracion: "Duración", unitId: "ID de unidad", typeId: "ID de tipo", observaciones: "Observaciones",
  startTime: "Hora de inicio", endTime: "Hora de fin", sortOrder: "Orden", fieldId: "ID de cancha", timeSlotId: "ID de horario",
  homeTeamId: "ID de equipo local", awayTeamId: "ID de equipo visitante", createdAt: "Fecha de creación", updatedAt: "Última actualización",
  clasificacion: "Clasificación", clasificacionCongelada: "Clasificación congelada", equiposCopiados: "Equipos copiados",
  criteria: "Criterios de desempate", scorerCriteria: "Criterios de goleo", stages: "Fases", zones: "Zonas", contenido: "Contenido",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function snapshot(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  return isRecord(value) ? value : { contenido: value };
}

function sameValue(before: unknown, after: unknown): boolean {
  if (Object.is(before, after)) return true;
  if (Array.isArray(before) && Array.isArray(after)) return before.length === after.length && before.every((item, i) => sameValue(item, after[i]));
  if (isRecord(before) && isRecord(after)) {
    const keys = Object.keys(before);
    return keys.length === Object.keys(after).length && keys.every((key) => Object.hasOwn(after, key) && sameValue(before[key], after[key]));
  }
  return false;
}

export function auditChanges(before: unknown, after: unknown) {
  const b = snapshot(before), a = snapshot(after);
  return [...new Set([...Object.keys(b), ...Object.keys(a)])].map((key) => {
    const before = Object.hasOwn(b, key) ? b[key] : undefined;
    const after = Object.hasOwn(a, key) ? a[key] : undefined;
    return {
      key, label: Object.hasOwn(FIELD_LABELS, key) ? FIELD_LABELS[key] : key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase()),
      before, after, changed: !sameValue(before, after),
    };
  });
}

export function auditValue(value: unknown): string {
  if (value === undefined) return "No registrado";
  if (value === null) return "Sin valor";
  if (value === "") return "Texto vacío";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
}
