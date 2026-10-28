import type { Prisma } from "@prisma/client";
import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { createPlayerAction, importPlayersCsvAction } from "@/server/actions/people";
import { CsvImportButton, PlayerCreateButton } from "@/components/forms/entity-forms";
import { PlayersDirectory } from "@/components/players/PlayersDirectory";
import { Card, EmptyState, inputClass, LinkButton, PageHeader, Pagination, withParams } from "@/components/ui/core";
import { PAGE_SIZE, str, type SP } from "@/lib/params";
import { normalizeName } from "@/domain/text";
import { directoryPage } from "@/domain/filters";
import { PLAYER_ORDER_OPTIONS, resolvePlayersView } from "@/domain/players-view";
import { FilterField, FilterPanel, FilterSelect } from "@/components/ui/filters";
import { SearchableFilter } from "@/components/ui/SearchableFilter";

export const metadata = { title: "Jugadores" };

export default async function JugadoresPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Prepara la temporada para registrar jugadores" description="Cada jugador forma parte de un equipo y conserva su trayectoria durante la temporada." action={<LinkButton href="/configuracion/temporadas">Configurar temporada</LinkButton>} />;
  const teams = await prisma.team.findMany({ where: { seasonId: ctx.id }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, active: true, leagueId: true, league: { select: { name: true } } } });
  if (teams.length === 0) return <EmptyState title="Registra equipos para completar sus plantillas" description="Después podrás agregar jugadores, consultar sus goles y llevar el seguimiento de sus sanciones." action={<LinkButton href="/equipos">Registrar equipos</LinkButton>} />;
  const sp = await searchParams;
  const { q, liga, equipo, estado, orden, sort, dir, requestedPage, defaultTeamId } = resolvePlayersView(Object.fromEntries(Object.entries(sp).map(([key, value]) => [key, str(value)])), ctx.leagues.map((league) => league.id), teams);
  const where: Prisma.PlayerWhereInput = { seasonId: ctx.id,
    ...(equipo ? { teamId: equipo } : {}), ...(liga ? { team: { leagueId: liga } } : {}),
    ...(estado === "activos" ? { active: true } : estado === "inactivos" ? { active: false } : {}),
    ...(q ? { nameKey: { contains: normalizeName(q) } } : {}),
  };
  const orderBy: Prisma.PlayerOrderByWithRelationInput[] = sort === "team" ? [{ team: { name: dir } }, { fullName: "asc" }, { id: "asc" }]
    : sort === "number" ? [{ jerseyNumber: { sort: dir, nulls: "last" } }, { fullName: "asc" }, { id: "asc" }] : [{ fullName: dir }, { id: "asc" }];
  const [total, seasonTotal] = await Promise.all([prisma.player.count({ where }), prisma.player.count({ where: { seasonId: ctx.id } })]);
  const { page, pageCount, skip } = directoryPage(requestedPage, total, PAGE_SIZE);
  const players = await prisma.player.findMany({ where, orderBy, skip, take: PAGE_SIZE, select: {
    id: true, fullName: true, jerseyNumber: true, active: true, isDemo: true,
    team: { select: { id: true, name: true, active: true, league: { select: { name: true } } } },
  } });
  const goals = await prisma.matchScorer.groupBy({ by: ["playerId"], where: { playerId: { in: players.map((player) => player.id) }, match: { status: "JUGADO", type: { not: "AMISTOSO" } } }, _sum: { goals: true } });
  const goalMap = new Map(goals.map((goal) => [goal.playerId, goal._sum.goals ?? 0]));
  const teamOpts = teams.map((team) => ({ value: team.id, label: `${team.name} (${team.league.name})${team.active ? "" : " · Baja"}` }));
  const importOpts = teams.filter((team) => team.active).map((team) => ({ value: team.id, label: `${team.name} (${team.league.name})` }));
  const createOpts = teams.filter((team) => team.active && (!liga || team.leagueId === liga)).map((team) => ({ value: team.id, label: `${team.name} (${team.league.name})` }));
  const selectedTeam = teams.find((team) => team.id === equipo);
  const selectedLeague = ctx.leagues.find((league) => league.id === liga);
  const base = { q, liga, equipo, estado, orden };

  return <>
    <PageHeader title="Jugadores" description="Consulta las plantillas, encuentra a cada jugador y revisa sus goles y trayectoria."
      actions={<>
        <CsvImportButton action={importPlayersCsvAction} title="Importar jugadores desde CSV" columns="nombre, equipo, numero" example={"nombre,equipo,numero\nRuben Arriaga,Venus FC,9"}
          defaultSelect={{ name: "teamId", label: "Equipo por defecto (si el archivo no lo indica)", options: importOpts }} />
        {createOpts.length > 0 ? <PlayerCreateButton action={createPlayerAction} teams={createOpts} defaultTeamId={defaultTeamId} />
        : <LinkButton href={withParams("/equipos", { liga, estado: "todos" })}>Administrar equipos</LinkButton>}
      </>} />
    <section aria-label="Contexto de los jugadores" className="bg-sport mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border-l-4 border-orange-400 px-5 py-5 text-white sm:px-6">
      <div className="min-w-0"><p className="mb-1 text-xs font-medium text-blue-100">{ctx.name}</p><h2 className="text-xl font-bold break-words">{selectedTeam?.name ?? selectedLeague?.name ?? "Plantillas de la temporada"}</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100">{selectedTeam ? `${selectedTeam.league.name}${selectedTeam.active ? "" : " · Equipo dado de baja"}` : "Consulta el equipo actual y el historial individual de cada participante."}</p></div>
      <span className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold"><Users className="h-4 w-4" aria-hidden />{seasonTotal} {seasonTotal === 1 ? "jugador registrado" : "jugadores registrados"}</span>
    </section>

    <Card>
      <FilterPanel key={JSON.stringify(base)} path="/jugadores" params={base} total={total} chips={[
        { name: "q", label: "Nombre", value: q }, { name: "liga", label: "Liga", value: selectedLeague?.name },
        { name: "equipo", label: "Equipo", value: selectedTeam?.name },
        { name: "estado", label: "Estado", value: estado === "activos" ? "Activos" : estado === "inactivos" ? "Inactivos" : undefined, resetValue: "todos" },
      ]}>
        <FilterField name="q" label="Nombre del jugador"><input id="q" name="q" type="search" defaultValue={q} placeholder="Buscar jugador por nombre" className={inputClass} /></FilterField>
        <FilterSelect name="liga" label="Liga actual" value={liga} all="Todas las ligas" options={ctx.leagues.map((league) => ({ value: league.id, label: league.name }))} />
        <SearchableFilter name="equipo" label="Equipo actual" value={equipo} all="Todos los equipos" options={teamOpts} />
        <FilterSelect name="estado" label="Estado del jugador" value={estado} all={false} options={[{ value: "activos", label: "Activos" }, { value: "inactivos", label: "Inactivos" }, { value: "todos", label: "Todos" }]} />
        <div className="sm:col-span-2"><FilterSelect name="orden" label="Ordenar por" value={orden} all={false} options={PLAYER_ORDER_OPTIONS} /></div>
      </FilterPanel>
      {players.length === 0 ? <EmptyState title={seasonTotal > 0 ? "No hay jugadores con estos filtros" : "Completa las primeras plantillas"}
        description={seasonTotal > 0 ? "Prueba otro nombre, cambia el equipo o incluye a los jugadores inactivos." : "Registra a los jugadores de cada equipo para llevar sus goles y sanciones."}
        action={seasonTotal > 0 ? <LinkButton href="/jugadores?estado=todos" variant="secondary">Ver todos los jugadores</LinkButton> : createOpts.length > 0 ? <PlayerCreateButton action={createPlayerAction} teams={createOpts} defaultTeamId={defaultTeamId} /> : <LinkButton href="/equipos?estado=todos" variant="secondary">Administrar equipos</LinkButton>} />
      : <PlayersDirectory players={players} goals={goalMap} />}
      <Pagination page={page} pageCount={pageCount} total={total} hrefFor={(next) => withParams("/jugadores", { ...base, page: next })} />
    </Card>
    <p className="mt-4 text-xs leading-relaxed text-slate-600">La liga y el equipo corresponden al registro actual del jugador. Los goles acumulan toda su temporada, incluidos equipos anteriores y eliminatorias; los amistosos y los penales de desempate se excluyen.</p>
  </>;
}
