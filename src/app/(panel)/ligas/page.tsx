import Link from "next/link";
import { ArrowUpRight, Shield, Swords, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { str, type SP } from "@/lib/params";
import { requireSeasonContext } from "@/server/season";
import { createLeagueAction, setLeagueActiveAction, updateLeagueAction } from "@/server/actions/teams";
import { filterLeagues, resolveLeagueFilters } from "@/domain/leagues-view";
import { LeagueFormButton, SimpleToggleForm } from "@/components/forms/entity-forms";
import { LeaguePhase, LeagueStatus } from "@/components/leagues/LeagueStatus";
import { Card, EmptyState, inputClass, LinkButton, PageHeader, withParams } from "@/components/ui/core";
import { FilterField, FilterPanel, FilterSelect } from "@/components/ui/filters";

export const metadata = { title: "Ligas" };

export default async function LigasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Prepara la temporada para registrar ligas" description="Cada liga reúne a sus equipos, jornadas y clasificaciones."
    action={<LinkButton href="/configuracion/temporadas">Configurar temporada</LinkButton>} />;
  const sp = await searchParams;
  const filters = resolveLeagueFilters({ q: str(sp.q), estado: str(sp.estado) });
  const [leagues, played] = await Promise.all([
    prisma.league.findMany({
      where: { seasonId: ctx.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        championTeam: { select: { name: true } },
        _count: { select: { teams: { where: { active: true } } } },
        standingSnapshots: { where: { kind: "CIERRE_FASE_REGULAR" }, select: { id: true } },
      },
    }),
    prisma.match.groupBy({ by: ["leagueId"], where: { seasonId: ctx.id, status: "JUGADO" }, _count: true }),
  ]);
  const visible = filterLeagues(leagues, filters);
  const activeCount = leagues.filter((league) => league.active).length;
  const playedByLeague = new Map(played.map((item) => [item.leagueId, item._count]));

  return <>
    <PageHeader title="Ligas" description="Organiza las ligas de la temporada y abre sus equipos, jornadas y clasificaciones."
      actions={<LeagueFormButton action={createLeagueAction} />} />

    <section aria-label="Temporada de las ligas" className="bg-sport mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border-l-4 border-orange-400 px-5 py-5 text-white sm:px-6">
      <div className="min-w-0">
        <h2 className="text-xl font-bold break-words">{ctx.name}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-blue-100">Elige una liga para consultar su actividad o administrar sus participantes.</p>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-blue-100"><span><strong className="text-white">{activeCount}</strong> {activeCount === 1 ? "activa" : "activas"}</span><span><strong className="text-white">{leagues.length - activeCount}</strong> {leagues.length - activeCount === 1 ? "inactiva" : "inactivas"}</span></p>
    </section>

    {leagues.length > 0 && <Card className="mb-5 overflow-hidden">
      <FilterPanel key={JSON.stringify(filters)} path="/ligas" params={filters} total={visible.length} chips={[
        { name: "q", label: "Nombre", value: filters.q },
        { name: "estado", label: "Estado", value: filters.estado === "activas" ? "Activas" : filters.estado === "inactivas" ? "Inactivas" : undefined },
      ]}>
        <div className="xl:col-span-3"><FilterField name="q" label="Nombre de la liga"><input id="q" name="q" type="search" defaultValue={filters.q} placeholder="Buscar liga por nombre" className={inputClass} /></FilterField></div>
        <FilterSelect name="estado" label="Estado" value={filters.estado} all="Todas las ligas" options={[{ value: "activas", label: "Activas" }, { value: "inactivas", label: "Inactivas" }]} />
      </FilterPanel>
    </Card>}

    {visible.length === 0 ? <Card><EmptyState title={leagues.length ? "No hay ligas con estos filtros" : "Crea la primera liga de la temporada"}
      description={leagues.length ? "Prueba otro nombre o consulta las ligas activas e inactivas." : "Después podrás registrar sus equipos y preparar el calendario de partidos."}
      action={leagues.length ? <LinkButton href="/ligas" variant="secondary">Quitar filtros</LinkButton> : <LeagueFormButton action={createLeagueAction} />} /></Card>
    : <ul aria-label="Ligas de la temporada" className="grid gap-4 xl:grid-cols-2">
      {visible.map((league) => <li key={league.id} className="min-w-0">
        <article aria-labelledby={`liga-${league.id}`} className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 id={`liga-${league.id}`} className="text-lg font-bold text-[#102d50]"><Link href={`/ligas/${league.id}`} className="rounded break-words hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">{league.name}</Link></h2>
              <div className="mt-2"><LeaguePhase hasChampion={!!league.championTeam} hasSnapshot={league.standingSnapshots.length > 0} /></div>
            </div>
            <LeagueStatus active={league.active} />
          </div>
          <div className="flex-1 px-5 py-4">
            <dl className="grid grid-cols-2 divide-x divide-slate-200">
              <div className="pr-4"><dt className="flex items-center gap-2 text-xs font-medium text-slate-600"><Shield className="h-4 w-4 shrink-0 text-blue-800" aria-hidden />Equipos activos</dt><dd className="mt-1 text-2xl font-bold text-[#102d50] tabular-nums">{league._count.teams}</dd></div>
              <div className="pl-4"><dt className="flex items-center gap-2 text-xs font-medium text-slate-600"><Swords className="h-4 w-4 shrink-0 text-blue-800" aria-hidden />Partidos disputados</dt><dd className="mt-1 text-2xl font-bold text-[#102d50] tabular-nums">{playedByLeague.get(league.id) ?? 0}</dd></div>
            </dl>
            {league.championTeam ? <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"><Trophy className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span className="min-w-0 break-words"><strong>Campeón:</strong> {league.championTeam.name}</span></p>
            : league._count.teams === 0 ? <p className="mt-4 text-sm leading-relaxed text-slate-600">Aún no tiene equipos activos. <Link href={withParams("/equipos", { liga: league.id })} className="rounded font-semibold text-blue-800 underline focus-visible:outline-2 focus-visible:outline-blue-700">Registrar equipos</Link></p> : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
            <LinkButton href={`/ligas/${league.id}`} size="sm" aria-label={`Ver liga ${league.name}`}>Ver liga<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></LinkButton>
            <div className="flex flex-wrap gap-2" role="group" aria-label={`Administrar ${league.name}`}>
              <LeagueFormButton action={updateLeagueAction} league={{ id: league.id, name: league.name, sortOrder: league.sortOrder }} />
              <SimpleToggleForm action={setLeagueActiveAction} hidden={{ id: league.id, active: league.active ? "0" : "1" }} label={league.active ? "Desactivar" : "Activar"} variant={league.active ? "danger" : "secondary"} />
            </div>
          </div>
        </article>
      </li>)}
    </ul>}
    {visible.length > 0 && <p className="mt-4 text-xs leading-relaxed text-slate-600">Las ligas siguen su orden de presentación. Los partidos disputados cuentan los encuentros asignados a cada liga, incluidos amistosos y eliminatorias.</p>}
  </>;
}
