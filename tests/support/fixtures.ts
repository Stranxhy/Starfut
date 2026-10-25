import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/domain/text";
import { createSeasonWithDefaults, ensureBase } from "../../prisma/seed";
import type { PrismaClient } from "@prisma/client";

let counter = 0;

/** Crea una temporada aislada con dos ligas, equipos y jugadores. */
export async function createFixture(opts: { teamsA?: number; teamsB?: number } = {}) {
  const db = prisma as unknown as PrismaClient;
  const { tournament, venue } = await ensureBase(db);
  const tag = `${Date.now()}-${counter++}`;
  const season = await createSeasonWithDefaults(db, {
    tournamentId: tournament.id,
    venueId: venue.id,
    name: `Prueba ${tag}`,
    startDate: new Date("2026-08-02T00:00:00Z"),
    isCurrent: false,
    leagueNames: ["Liga A", "Liga B"],
  });
  const leagues = await prisma.league.findMany({ where: { seasonId: season.id }, orderBy: { sortOrder: "asc" } });
  const mkTeams = async (leagueId: string, prefix: string, n: number) => {
    const out = [];
    for (let i = 1; i <= n; i++) {
      const name = `${prefix} ${i}`;
      const t = await prisma.team.create({ data: { seasonId: season.id, leagueId, name, nameKey: normalizeName(`${name} ${tag}`) } });
      const players = [];
      for (let j = 1; j <= 3; j++) {
        const p = await prisma.player.create({
          data: { seasonId: season.id, teamId: t.id, fullName: `${name} Jugador ${j}`, nameKey: normalizeName(`${name} J${j}`), jerseyNumber: j },
        });
        await prisma.playerTeamHistory.create({ data: { playerId: p.id, teamId: t.id } });
        players.push(p);
      }
      out.push({ ...t, players });
    }
    return out;
  };
  const teamsA = await mkTeams(leagues[0].id, "Equipo A", opts.teamsA ?? 6);
  const teamsB = await mkTeams(leagues[1].id, "Equipo B", opts.teamsB ?? 4);
  const timeSlots = await prisma.timeSlot.findMany({ where: { seasonId: season.id }, orderBy: { startTime: "asc" } });
  const fields = await prisma.field.findMany({ where: { venueId: venue.id }, orderBy: { sortOrder: "asc" } });
  let user = await prisma.user.findFirst({ where: { email: "pruebas@starfutbol.local" } });
  user ??= await prisma.user.create({ data: { email: "pruebas@starfutbol.local", name: "Pruebas", passwordHash: "x" } });
  return { season, leagues, teamsA, teamsB, timeSlots, fields, userId: user.id };
}

export type Fixture = Awaited<ReturnType<typeof createFixture>>;

/** Crea un partido programado directamente (sin pasar por el generador). */
export async function quickMatch(
  f: Fixture,
  home: string,
  away: string,
  date: string,
  slot = 0,
  field = 0,
  extra: Partial<{ type: "OFICIAL" | "SUSTITUCION" | "AMISTOSO" | "INTERLIGA"; countsForStandings: boolean; leagueId: string }> = {},
) {
  return prisma.match.create({
    data: {
      seasonId: f.season.id,
      leagueId: extra.leagueId ?? f.leagues[0].id,
      date: new Date(`${date}T00:00:00Z`),
      timeSlotId: f.timeSlots[slot].id,
      fieldId: f.fields[field].id,
      homeTeamId: home,
      awayTeamId: away,
      status: "PROGRAMADO",
      type: extra.type ?? "OFICIAL",
      countsForStandings: extra.countsForStandings ?? true,
    },
  });
}
