export type NavigationItem = { href: string; label: string; icon: string; aliases?: string[] };
export type NavigationGroup = { label?: string; items: NavigationItem[]; collapsible?: boolean };

export const navigation: NavigationGroup[] = [
  { items: [{ href: "/", label: "Inicio", icon: "home" }] },
  { label: "Competencia", items: [
    { href: "/calendario", label: "Calendario", icon: "calendar" },
    { href: "/partidos", label: "Partidos y resultados", icon: "matches", aliases: ["/resultados"] },
    { href: "/tabla", label: "Tabla general", icon: "table" },
    { href: "/goleo", label: "Goleadores", icon: "goal" },
    { href: "/eliminatorias", label: "Eliminatorias", icon: "bracket" },
  ] },
  { label: "Participantes", items: [
    { href: "/ligas", label: "Ligas", icon: "league" },
    { href: "/equipos", label: "Equipos", icon: "team" },
    { href: "/jugadores", label: "Jugadores", icon: "players" },
  ] },
  { label: "Disciplina", items: [{ href: "/sanciones", label: "Sanciones", icon: "sanctions" }] },
  { items: [{ href: "/reportes", label: "Reportes y PDF", icon: "reports" }] },
  { label: "Administración", collapsible: true, items: [
    { href: "/configuracion", label: "Configuración", icon: "settings" },
    { href: "/historial", label: "Historial de cambios", icon: "history" },
    { href: "/usuarios", label: "Usuarios y respaldos", icon: "users" },
  ] },
];

export function isNavigationActive(item: NavigationItem, pathname: string) {
  return [item.href, ...(item.aliases ?? [])].some((href) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)));
}

export function navigationContext(pathname: string) {
  for (const group of navigation) {
    const item = group.items.find((entry) => isNavigationActive(entry, pathname));
    if (item) return { group: group.label, item };
  }
  return null;
}

/** Conserva el contexto compartido al alternar entre las dos vistas. */
export function matchViewHref(path: "/partidos" | "/resultados", date: string | null, league?: string | null) {
  const params = new URLSearchParams();
  if (date) params.set(path === "/partidos" ? "fecha" : "date", date);
  if (league) params.set("liga", league);
  return params.size ? `${path}?${params}` : path;
}
