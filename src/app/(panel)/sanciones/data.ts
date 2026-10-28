import "server-only";
import { prisma } from "@/lib/prisma";
import { formatShort, todayISO } from "@/lib/dates";
import { UNIT_KIND } from "@/lib/labels";
import type { SanctionFormData } from "@/components/forms/SanctionForm";

/** Al editar, conserva los valores archivados que ya pertenecen a la sanción. */
export async function loadSanctionFormData(seasonId: string, current?: { typeId: string; unitId: string; matchId: string | null }): Promise<SanctionFormData> {
  const matchSelect = { id: true, date: true, status: true, homeTeamId: true, awayTeamId: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } } as const;
  const [teams, matches, types, units, currentMatch] = await Promise.all([
    prisma.team.findMany({
      where: { seasonId }, orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, active: true, leagueId: true, league: { select: { name: true } },
        players: { where: { active: true }, orderBy: [{ fullName: "asc" }, { id: "asc" }], select: { id: true, fullName: true } } },
    }),
    prisma.match.findMany({
      where: { seasonId, status: { not: "CANCELADO" }, date: { not: null } },
      orderBy: [{ date: "desc" }, { id: "asc" }], take: 400, select: matchSelect,
    }),
    prisma.sanctionType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
    prisma.sanctionUnit.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true, kind: true } }),
    current?.matchId ? prisma.match.findFirst({ where: { id: current.matchId, seasonId }, select: matchSelect }) : null,
  ]);
  const matchOptions = currentMatch && !matches.some((match) => match.id === currentMatch.id) ? [currentMatch, ...matches] : matches;
  const typeOption = (type: typeof types[number]) => ({ value: type.id, label: `${type.name}${type.active ? "" : " (inactivo)"}` });
  return {
    today: todayISO(),
    teams: teams.map((team) => ({ id: team.id, name: team.name, active: team.active, leagueId: team.leagueId, leagueName: team.league.name, players: team.players })),
    matches: matchOptions.map((match) => ({
      id: match.id,
      label: `${formatShort(match.date)} · ${match.homeTeam.name} vs ${match.awayTeam.name}${match.status === "CANCELADO" ? " (cancelado)" : ""}`,
      teamIds: [match.homeTeamId, match.awayTeamId],
    })),
    filterTypes: types.map(typeOption),
    types: types.filter((type) => type.active || type.id === current?.typeId).map(typeOption),
    units: units.filter((unit) => unit.active || unit.id === current?.unitId).map((unit) => ({ value: unit.id, label: `${unit.name} (${UNIT_KIND[unit.kind]})${unit.active ? "" : " (inactiva)"}`, kind: unit.kind })),
  };
}
