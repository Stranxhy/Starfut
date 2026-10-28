export type ScorersPeriod = { period: string; round: number | undefined; includePlayoffs: boolean };

/** Una jornada concreta limita la consulta a fase regular. Conserva las URLs antiguas. */
export function resolveScorersPeriod(
  query: { periodo?: string; jornada?: string; eliminatorias?: string },
  rounds: number[],
): ScorersPeriod {
  if (query.periodo === "completa") return { period: "completa", round: undefined, includePlayoffs: true };
  if (query.periodo === "regular") return { period: "regular", round: undefined, includePlayoffs: false };
  const requested = query.periodo?.startsWith("jornada-") ? query.periodo.slice(8) : query.periodo === undefined ? query.jornada : undefined;
  const round = rounds.find((number) => number > 0 && String(number) === requested);
  if (round !== undefined) return { period: `jornada-${round}`, round, includePlayoffs: false };
  const includePlayoffs = query.periodo === undefined && query.eliminatorias === "1";
  return { period: includePlayoffs ? "completa" : "regular", round: undefined, includePlayoffs };
}

export function scorersPdfHref(leagueId: string, selection: ScorersPeriod) {
  const query = new URLSearchParams({ league: leagueId });
  if (selection.round !== undefined) query.set("round", String(selection.round));
  else if (selection.includePlayoffs) query.set("playoffs", "1");
  return `/api/pdf/goleo?${query}`;
}
