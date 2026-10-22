import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const SEASON_COOKIE = "sf_season";

/** Temporada seleccionada en el panel (cookie) o, por defecto, la vigente. */
export async function getSeasonId(): Promise<string | null> {
  const jar = await cookies();
  const fromCookie = jar.get(SEASON_COOKIE)?.value;
  if (fromCookie) {
    const s = await prisma.season.findUnique({ where: { id: fromCookie }, select: { id: true } });
    if (s) return s.id;
  }
  const current =
    (await prisma.season.findFirst({ where: { isCurrent: true }, select: { id: true } })) ??
    (await prisma.season.findFirst({ orderBy: { startDate: "desc" }, select: { id: true } }));
  return current?.id ?? null;
}

export async function getSeasonContext(seasonId: string) {
  const season = await prisma.season.findUniqueOrThrow({
    where: { id: seasonId },
    include: {
      tournament: true,
      venue: { include: { fields: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } } },
      leagues: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      timeSlots: { orderBy: [{ startTime: "asc" }] },
    },
  });
  return season;
}

export type SeasonContext = Awaited<ReturnType<typeof getSeasonContext>>;

export async function requireSeasonContext(): Promise<SeasonContext | null> {
  const id = await getSeasonId();
  if (!id) return null;
  return getSeasonContext(id);
}
