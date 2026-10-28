import type { Prisma } from "@prisma/client";
import { FileDown, Shield } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { createTeamAction, importTeamsCsvAction } from "@/server/actions/teams";
import { CsvImportButton, TeamCreateButton } from "@/components/forms/entity-forms";
import { TeamsDirectory } from "@/components/teams/TeamsDirectory";
import { Card, EmptyState, inputClass, LinkButton, PageHeader, Pagination, withParams } from "@/components/ui/core";
import { PAGE_SIZE, str, type SP } from "@/lib/params";
import { normalizeName } from "@/domain/text";
import { resolveTeamsView, TEAM_ORDER_OPTIONS, teamDirectoryPage } from "@/domain/teams-view";
import { FilterField, FilterPanel, FilterSelect } from "@/components/ui/filters";

export const metadata = { title: "Equipos" };

export default async function EquiposPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Prepara la temporada para registrar equipos" description="Organiza a los participantes por liga y reúne sus plantillas en un solo lugar." action={<LinkButton href="/configuracion/temporadas">Configurar temporada</LinkButton>} />;
  if (ctx.leagues.length === 0) return <EmptyState title="Crea una liga para registrar sus equipos" description="Cada equipo pertenece a una liga de la temporada. Después podrás agregar jugadores y preparar sus partidos." action={<LinkButton href="/ligas">Registrar ligas</LinkButton>} />;
  const sp = await searchParams;
  const { q, liga, estado, orden, sort, dir, requestedPage } = resolveTeamsView(Object.fromEntries(Object.entries(sp).map(([key, value]) => [key, str(value)])), ctx.leagues.map((league) => league.id));
  const where: Prisma.TeamWhereInput = {
    seasonId: ctx.id,
    ...(liga ? { leagueId: liga } : {}),
    ...(estado === "activos" ? { active: true } : estado === "inactivos" ? { active: false } : {}),
    ...(q ? { nameKey: { contains: normalizeName(q) } } : {}),
  };
  const orderBy: Prisma.TeamOrderByWithRelationInput[] = sort === "league"
    ? [{ league: { sortOrder: dir } }, { league: { name: dir } }, { name: "asc" }, { id: "asc" }]
    : sort === "created" ? [{ createdAt: dir }, { id: "asc" }] : [{ name: dir }, { id: "asc" }];
  const [total, seasonTotal] = await Promise.all([
    prisma.team.count({ where }),
    prisma.team.count({ where: { seasonId: ctx.id } }),
  ]);
  const { page, pageCount, skip } = teamDirectoryPage(requestedPage, total, PAGE_SIZE);
  const teams = await prisma.team.findMany({ where, orderBy, skip, take: PAGE_SIZE, select: {
    id: true, name: true, active: true, isDemo: true, logoMime: true,
    league: { select: { id: true, name: true } }, _count: { select: { players: { where: { active: true } } } },
  } });
  const leagueOpts = ctx.leagues.map((league) => ({ value: league.id, label: league.name }));
  const selectedLeague = ctx.leagues.find((league) => league.id === liga);
  const base = { q, liga, estado, orden };

  return <>
    <PageHeader title="Equipos" description="Encuentra cada equipo, consulta su plantilla y administra sus datos y partidos."
      actions={<>
        <LinkButton href={withParams("/api/pdf/equipos", { league: liga })} target="_blank" variant="secondary"><FileDown className="h-4 w-4" aria-hidden />PDF de equipos</LinkButton>
        <CsvImportButton action={importTeamsCsvAction} title="Importar equipos desde CSV" columns="nombre, liga, contacto, telefono, correo"
          example={"nombre,liga,contacto,telefono,correo\nVenus FC,Premium,Juan Pérez,5512345678,"}
          defaultSelect={{ name: "leagueId", label: "Liga por defecto (si el archivo no la indica)", options: leagueOpts }} />
        <TeamCreateButton action={createTeamAction} leagues={leagueOpts} defaultLeagueId={liga || undefined} />
      </>} />
    <section aria-label="Contexto de los equipos" className="bg-sport mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border-l-4 border-orange-400 px-5 py-5 text-white sm:px-6">
      <div className="min-w-0"><p className="mb-1 text-xs font-medium text-blue-100">{ctx.name}</p><h2 className="text-xl font-bold break-words">{selectedLeague?.name ?? "Equipos de todas las ligas"}</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100">Abre una ficha para consultar jugadores, próximos encuentros y datos de contacto.</p></div>
      <span className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold"><Shield className="h-4 w-4" aria-hidden />{seasonTotal} {seasonTotal === 1 ? "equipo en la temporada" : "equipos en la temporada"}</span>
    </section>

    <Card className="overflow-hidden">
      <FilterPanel key={JSON.stringify(base)} path="/equipos" params={base} total={total} chips={[
        { name: "q", label: "Nombre", value: q },
        { name: "liga", label: "Liga", value: selectedLeague?.name },
        { name: "estado", label: "Estado", value: estado === "activos" ? "Activos" : estado === "inactivos" ? "Dados de baja" : undefined, resetValue: "todos" },
      ]}>
        <FilterField name="q" label="Nombre del equipo"><input id="q" name="q" type="search" defaultValue={q} placeholder="Buscar equipo por nombre" className={inputClass} /></FilterField>
        <FilterSelect name="liga" label="Liga" value={liga} all="Todas las ligas" options={leagueOpts} />
        <FilterSelect name="estado" label="Estado" value={estado} all={false} options={[{ value: "activos", label: "Activos" }, { value: "inactivos", label: "Dados de baja" }, { value: "todos", label: "Todos" }]} />
        <FilterSelect name="orden" label="Ordenar por" value={orden} all={false} options={TEAM_ORDER_OPTIONS} />
      </FilterPanel>
      {teams.length === 0 ? <EmptyState title={seasonTotal > 0 ? "No hay equipos con estos filtros" : "Registra los primeros equipos"}
        description={seasonTotal > 0 ? "Prueba otro nombre, cambia de liga o incluye a los equipos dados de baja." : "Agrega los participantes de cada liga para preparar sus plantillas y encuentros."}
        action={seasonTotal > 0 ? <LinkButton href="/equipos?estado=todos" variant="secondary">Ver todos los equipos</LinkButton> : <TeamCreateButton action={createTeamAction} leagues={leagueOpts} defaultLeagueId={liga || undefined} />} />
      : <TeamsDirectory teams={teams} />}
      <Pagination page={page} pageCount={pageCount} total={total} hrefFor={(next) => withParams("/equipos", { ...base, page: next })} />
    </Card>
    <p className="mt-4 text-xs leading-relaxed text-slate-600">El PDF incluye todos los equipos de {selectedLeague ? "la liga seleccionada" : "la temporada"}, también los dados de baja. La búsqueda por nombre, el estado y el orden se aplican a esta lista.</p>
  </>;
}
