import { normalizeName } from "./text";
import { roundMatchesHref, type CalendarRound } from "./calendar";

export function resolveLeagueFilters(query: { q?: string; estado?: string }) {
  return {
    q: query.q?.trim() ?? "",
    estado: query.estado === "activas" || query.estado === "inactivas" ? query.estado : "",
  };
}

export function filterLeagues<T extends { name: string; active: boolean }>(leagues: T[], filters: ReturnType<typeof resolveLeagueFilters>): T[] {
  const search = normalizeName(filters.q);
  return leagues.filter((league) => (
    (!search || normalizeName(league.name).includes(search)) &&
    (!filters.estado || league.active === (filters.estado === "activas"))
  ));
}

/** La jornada incluye reprogramaciones: no se filtra por su fecha original. */
export function leagueRoundHref(leagueId: string, round: Pick<CalendarRound, "phase" | "number">) {
  const [path, query] = roundMatchesHref(round).split("?");
  const params = new URLSearchParams(query);
  params.set("liga", leagueId);
  return `${path}?${params}`;
}

export function leagueStandingPosition(row: { position: number; unresolvedTieGroup: number | null } | undefined, hasResults: boolean) {
  if (!row) return "Sin posición";
  if (!hasResults) return "Sin resultados";
  return row.unresolvedTieGroup !== null ? "Por desempatar" : `${row.position}.º`;
}
