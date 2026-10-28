/** Una jornada histórica siempre corresponde al cálculo, no al cierre congelado. */
export function resolveStandingsView(
  query: { jornada?: string; vista?: string },
  rounds: number[],
  hasSnapshot: boolean,
): { round: number | undefined; view: "actual" | "final" } {
  const round = rounds.find((number) => number > 0 && String(number) === query.jornada);
  return {
    round,
    view: hasSnapshot && round === undefined && query.vista !== "actual" ? "final" : "actual",
  };
}
