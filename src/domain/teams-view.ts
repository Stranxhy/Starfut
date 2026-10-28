export const TEAM_ORDER_OPTIONS = [
  { value: "name-asc", label: "Nombre: A a Z" },
  { value: "name-desc", label: "Nombre: Z a A" },
  { value: "league-asc", label: "Liga: orden de presentación" },
  { value: "league-desc", label: "Liga: orden inverso" },
  { value: "created-desc", label: "Registro: más recientes" },
  { value: "created-asc", label: "Registro: más antiguos" },
];

export function resolveTeamsView(query: Record<string, string | undefined>, leagueIds: string[]) {
  const legacySort = query.sort === "league" || query.sort === "created" ? query.sort : "name";
  const legacyDirection = query.dir === "desc" ? "desc" : "asc";
  const orden = TEAM_ORDER_OPTIONS.some((option) => option.value === query.orden) ? query.orden! : `${legacySort}-${legacyDirection}`;
  const [sort, dir] = orden.split("-") as ["name" | "league" | "created", "asc" | "desc"];
  const requestedPage = Number(query.page);
  return {
    q: query.q?.trim() ?? "",
    liga: query.liga && leagueIds.includes(query.liga) ? query.liga : "",
    estado: query.estado === "inactivos" || query.estado === "todos" ? query.estado : "activos",
    orden, sort, dir,
    requestedPage: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  };
}

export { directoryPage as teamDirectoryPage } from "./filters";
