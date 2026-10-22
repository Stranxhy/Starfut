import "server-only";
import { prisma } from "@/lib/prisma";
import { formatShort } from "@/lib/dates";
import { UNIT_KIND } from "@/lib/labels";
import type { SanctionFormData } from "@/components/forms/SanctionForm";

export async function loadSanctionFormData(seasonId: string): Promise<SanctionFormData> {
  const [teams, matches, types, units] = await Promise.all([
    prisma.team.findMany({
      where: { seasonId },
      orderBy: { name: "asc" },
      include: { players: { where: { active: true }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } } },
    }),
    prisma.match.findMany({
      where: { seasonId, status: { not: "CANCELADO" }, date: { not: null } },
      orderBy: { date: "desc" },
      take: 400,
      include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
    }),
    prisma.sanctionType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.sanctionUnit.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    teams: teams.map((t) => ({ id: t.id, name: t.name, players: t.players })),
    matches: matches.map((m) => ({
      id: m.id,
      label: `${formatShort(m.date)} · ${m.homeTeam.name} vs ${m.awayTeam.name}`,
      teamIds: [m.homeTeamId, m.awayTeamId],
    })),
    types: types.map((t) => ({ value: t.id, label: t.name })),
    units: units.map((u) => ({ value: u.id, label: `${u.name} (${UNIT_KIND[u.kind]})`, kind: u.kind })),
  };
}
