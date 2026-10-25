import "server-only";
import { prisma } from "@/lib/prisma";
import { fromISODate, todayISO, toISODate } from "@/lib/dates";

/**
 * Fechas de juego relevantes para los PDF que se envían por WhatsApp:
 * - rol: la próxima fecha con partidos (o la última, si ya no hay próximas)
 * - resultados: la última fecha con partidos disputados
 */
export async function matchDays(seasonId: string) {
  const today = fromISODate(todayISO());
  const [dates, played] = await Promise.all([
    prisma.match.groupBy({ by: ["date"], where: { seasonId, date: { not: null }, status: { not: "CANCELADO" } }, orderBy: { date: "asc" } }),
    prisma.match.aggregate({ where: { seasonId, status: "JUGADO" }, _max: { date: true } }),
  ]);
  const all = dates.map((d) => toISODate(d.date)!).filter(Boolean);
  const upcoming = all.filter((d) => d >= toISODate(today)!);
  const past = all.filter((d) => d < toISODate(today)!);
  return {
    all,
    rolDate: upcoming[0] ?? all.at(-1) ?? null,
    resultsDate: toISODate(played._max.date) ?? past.at(-1) ?? null,
  };
}
