export type QuickReportDoc = "rol" | "resultados" | "tabla-general" | "goleo";
export type ReportDoc = "calendario" | "eliminatorias" | "historial-resultados" | "cancelaciones" | "equipos" | "estadisticas-equipo" | "sanciones";
export type ReportDefinition = { doc: ReportDoc; title: string; description: string; group: "competencia" | "participantes"; fields: "league" | "league-required" | "history" | "team-required" | "sanctions" };

export const REPORT_DOCUMENTS: ReportDefinition[] = [
  { doc: "calendario", title: "Calendario completo", description: "Consulta la programación de la temporada, de todas las ligas o de una sola.", group: "competencia", fields: "league" },
  { doc: "eliminatorias", title: "Cuadro de eliminatorias", description: "Cruces, resultados y avance de la fase final de una liga.", group: "competencia", fields: "league-required" },
  { doc: "historial-resultados", title: "Historial de resultados", description: "Reúne los resultados registrados y consulta el recorrido de un equipo.", group: "competencia", fields: "history" },
  { doc: "cancelaciones", title: "Cancelaciones y reprogramaciones", description: "Revisa los encuentros cancelados o reprogramados de la temporada.", group: "competencia", fields: "league" },
  { doc: "equipos", title: "Listado de equipos", description: "Participantes por liga, con su estado y número de jugadores activos.", group: "participantes", fields: "league" },
  { doc: "estadisticas-equipo", title: "Estadísticas de un equipo", description: "Clasificación, resultados, goleadores, sanciones y próximos partidos.", group: "participantes", fields: "team-required" },
  { doc: "sanciones", title: "Sanciones", description: "Motivos, duración y cumplimiento, filtrados por liga, estado y tipo.", group: "participantes", fields: "sanctions" },
];

export function resolveReportDates(query: { rol?: string; resultados?: string }, days: { all: string[]; rolDate: string | null; resultsDate: string | null }, today: string) {
  const rolDates = [...days.all];
  const resultDates = days.all.filter((date) => date <= today || date === days.resultsDate);
  const pick = (value: string | undefined, fallback: string | null, available: string[]) => value && available.includes(value) ? value : fallback && available.includes(fallback) ? fallback : null;
  return { rolDates, resultDates, rolDate: pick(query.rol, days.rolDate, rolDates), resultsDate: pick(query.resultados, days.resultsDate, resultDates) };
}

/** Fija la temporada para que cambiarla en otra pestaña no altere el documento. */
export function quickReportHref(doc: QuickReportDoc, seasonId: string, leagueId: string, date: string | null, download = false): string | null {
  if (!seasonId || !leagueId || ((doc === "rol" || doc === "resultados") && !date)) return null;
  const params = new URLSearchParams({ season: seasonId, league: leagueId });
  if ((doc === "rol" || doc === "resultados") && date) params.set("date", date);
  if (download) params.set("download", "1");
  return `/api/pdf/${doc}?${params}`;
}
