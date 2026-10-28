import { toISODate } from "@/lib/dates";

/** A URL date must represent a real day, not a date that JavaScript rolls forward. */
export function validMatchDate(value?: string): string | undefined {
  if (!value || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && toISODate(date) === value ? value : undefined;
}

export type CaptureState = "pendientes" | "registrados" | "programar" | "cancelados";

export function captureState(match: { status: string; date: Date | null; result: unknown }): CaptureState {
  if (match.status === "CANCELADO") return "cancelados";
  if (match.status === "PENDIENTE" || !match.date) return "programar";
  return match.result ? "registrados" : "pendientes";
}

/** Interleague matches use season rules, as does saveResult. */
export function resultRuleScope(match: { leagueId: string | null; homeTeam: { leagueId: string }; awayTeam: { leagueId: string } }): string | null {
  return match.homeTeam.leagueId === match.awayTeam.leagueId ? match.leagueId : null;
}

export function groupMatchesByDate<T extends { date: Date | null }>(matches: T[]): [string | null, T[]][] {
  const groups = new Map<string | null, T[]>();
  for (const match of matches) {
    const date = toISODate(match.date);
    const group = groups.get(date) ?? [];
    group.push(match);
    groups.set(date, group);
  }
  return [...groups];
}
