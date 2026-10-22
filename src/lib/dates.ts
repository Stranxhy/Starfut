// Las fechas de juego se guardan como DATE (sin hora) y se manejan como
// cadenas YYYY-MM-DD en UTC para evitar desfases por zona horaria.

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Mexico_City";

export function toISODate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export function fromISODate(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`Fecha inválida: ${s}`);
  return new Date(`${s}T00:00:00.000Z`);
}

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de la liga. */
export function todayISO(tz = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

/** 11/10/26 — formato usado en el rol de juegos. */
export function formatShort(iso: string | Date | null | undefined): string {
  const s = iso instanceof Date ? toISODate(iso) : iso;
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** domingo 11 de octubre de 2026 */
export function formatLong(iso: string | Date | null | undefined, withWeekday = true): string {
  const s = iso instanceof Date ? toISODate(iso) : iso;
  if (!s) return "—";
  const d = fromISODate(s);
  const base = `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
  return withWeekday ? `${DAYS[d.getUTCDay()]} ${base}` : base;
}

export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: APP_TIMEZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export const WEEKDAYS = DAYS;
