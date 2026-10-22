// Utilidades de formato para los PDF (sin dependencias de servidor).
import type { MatchLine } from "./data";

/** "08:10" → "8:10" (como en el rol de juegos de referencia). */
export function timeLabel(t: string | null | undefined): string {
  if (!t) return "—";
  const [h, m] = t.split(":");
  return `${Number(h)}:${m}`;
}

/** "Cancha 2" → "2" (la columna CAMPO de la referencia muestra solo el número). */
export function fieldLabel(name: string | null | undefined): string {
  if (!name) return "—";
  return name.replace(/^\s*(cancha|campo)\s*/i, "").trim() || name;
}

/** "1 partido", "3 partidos". */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function upper(s: string | null | undefined): string {
  return (s ?? "").toLocaleUpperCase("es-MX");
}

/** Marcador compacto "3 - 2" con penales "(4-3 pen.)" si hubo desempate. */
export function scoreLine(m: MatchLine): string {
  if (!m.result) return "—";
  const base = `${m.result.home} - ${m.result.away}`;
  if (m.result.homeSO != null && m.result.awaySO != null) return `${base} (${m.result.homeSO}-${m.result.awaySO} pen.)`;
  return base;
}

/** Texto de la columna de goles de un lado: "2", "2 EG", "CANCELADO", "—". */
export function sideGoals(m: MatchLine, side: "home" | "away"): { main: string; small?: string } {
  if (m.status === "CANCELADO") return { main: "CANCELADO" };
  if (!m.result) return { main: "—" };
  const goals = side === "home" ? m.result.home : m.result.away;
  if (m.result.type === "DESEMPATE") {
    const won = m.result.winner === side;
    return {
      main: won ? `${goals} EG` : String(goals),
      small: m.result.homeSO != null && m.result.awaySO != null
        ? `(${side === "home" ? m.result.homeSO : m.result.awaySO}-${side === "home" ? m.result.awaySO : m.result.homeSO} pen.)`
        : undefined,
    };
  }
  if (m.result.type === "ADMINISTRATIVO") return { main: String(goals), small: "ADMVO." };
  return { main: String(goals) };
}

/** Etiqueta corta del tipo/estado del partido para mostrar bajo el "VS" (cabe en ~36 pt). */
export function matchTag(m: MatchLine): string | null {
  if (m.status === "CANCELADO") return "CANCELADO";
  if (m.type === "AMISTOSO") return "AMISTOSO";
  if (m.type === "SUSTITUCION") return "SUSTITUC.";
  if (m.type === "INTERLIGA") return "INTERLIGA";
  if (m.stage !== "REGULAR" && m.stageName) return upper(m.stageName).split(/\s+/)[0];
  if (m.status === "REPROGRAMADO") return "REPROG.";
  if (m.status === "PENDIENTE") return "PENDIENTE";
  return null;
}
