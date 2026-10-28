export const PLAYER_ORDER_OPTIONS = [
  { value: "name-asc", label: "Nombre: A a Z" },
  { value: "name-desc", label: "Nombre: Z a A" },
  { value: "team-asc", label: "Equipo: A a Z" },
  { value: "team-desc", label: "Equipo: Z a A" },
  { value: "number-asc", label: "Camiseta: menor a mayor" },
  { value: "number-desc", label: "Camiseta: mayor a menor" },
];

export function resolvePlayersView(query: Record<string, string | undefined>, leagueIds: string[], teams: { id: string; leagueId: string; active: boolean }[]) {
  const legacySort = query.sort === "team" || query.sort === "number" ? query.sort : "name";
  const legacyDirection = query.dir === "desc" ? "desc" : "asc";
  const orden = PLAYER_ORDER_OPTIONS.some((option) => option.value === query.orden) ? query.orden! : `${legacySort}-${legacyDirection}`;
  const [sort, dir] = orden.split("-") as ["name" | "team" | "number", "asc" | "desc"];
  const liga = query.liga && leagueIds.includes(query.liga) ? query.liga : "";
  const selectedTeam = teams.find((team) => team.id === query.equipo && (!liga || team.leagueId === liga));
  const requestedPage = Number(query.page);
  return {
    q: query.q?.trim() ?? "", liga, equipo: selectedTeam?.id ?? "",
    defaultTeamId: selectedTeam?.active ? selectedTeam.id : undefined,
    estado: query.estado === "inactivos" || query.estado === "todos" ? query.estado : "activos",
    orden, sort, dir,
    requestedPage: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  };
}

type GoalEntry = { id: string; matchId: string; goals: number; match: { status: string; type: string; date: Date | null } };

/** Conserva los goles con equipos anteriores; cada partido cuenta una sola vez. */
export function playerGoalSummary<T extends GoalEntry>(entries: T[]) {
  const played = entries.filter((entry) => entry.match.status === "JUGADO")
    .sort((a, b) => (b.match.date?.getTime() ?? 0) - (a.match.date?.getTime() ?? 0) || a.id.localeCompare(b.id));
  const competition = played.filter((entry) => entry.match.type !== "AMISTOSO");
  return {
    played,
    competitionGoals: competition.reduce((sum, entry) => sum + entry.goals, 0),
    friendlyGoals: played.filter((entry) => entry.match.type === "AMISTOSO").reduce((sum, entry) => sum + entry.goals, 0),
    matchesWithGoal: new Set(competition.filter((entry) => entry.goals > 0).map((entry) => entry.matchId)).size,
  };
}
