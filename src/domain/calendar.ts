export type CalendarRound = {
  id: string; number: number; name: string | null; phase: "REGULAR" | "ELIMINATORIA";
  date: string; locked: boolean;
  matches: { status: string; date: string | null }[];
};

export function roundSummary(round: CalendarRound) {
  const active = round.matches.filter((match) => match.status !== "CANCELADO");
  const played = active.filter((match) => match.status === "JUGADO").length;
  return {
    active: active.length, played, remaining: active.length - played,
    cancelled: round.matches.length - active.length,
    moved: active.filter((match) => match.date !== null && match.date !== round.date).length,
    unassigned: active.filter((match) => match.status === "PENDIENTE").length,
  };
}

export function upcomingRound(rounds: CalendarRound[], today: string) {
  return rounds.filter((round) => round.date >= today && roundSummary(round).remaining > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number)[0];
}

export function validCalendarMonth(value: string | undefined): value is string {
  return !!value && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftCalendarMonth(month: string, offset: number) {
  const [year, number] = month.split("-").map(Number);
  const index = Math.max(12, Math.min(119999, year * 12 + number - 1 + offset));
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String(index % 12 + 1).padStart(2, "0")}`;
}

/** Semanas de lunes a domingo; los días externos al mes se dejan vacíos. */
export function calendarWeeks(month: string) {
  if (!validCalendarMonth(month)) throw new Error("Mes inválido");
  const [year, number] = month.split("-").map(Number);
  const first = new Date(0);
  first.setUTCFullYear(year, number - 1, 1);
  const last = new Date(first);
  last.setUTCMonth(number, 0);
  const offset = (first.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: Math.ceil((offset + last.getUTCDate()) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= last.getUTCDate() ? `${month}-${String(day).padStart(2, "0")}` : null;
  });
  return Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
}

export function roundTitle(round: Pick<CalendarRound, "phase" | "number" | "name">) {
  return round.phase === "REGULAR" ? `Jornada ${round.number}` : round.name ?? `Eliminatoria ${round.number}`;
}

export function roundMatchesHref(round: Pick<CalendarRound, "phase" | "number">) {
  return round.phase === "REGULAR" ? `/partidos?jornada=${round.number}` : "/eliminatorias";
}
