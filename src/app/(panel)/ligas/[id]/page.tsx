import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Goal, ListOrdered, Settings2, Shield, Swords, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { getLeagueStandings, getLeagueScorers } from "@/server/services/standings";
import { roundTitle } from "@/domain/calendar";
import { leagueRoundHref, leagueStandingPosition } from "@/domain/leagues-view";
import { LeaguePhase, LeagueStatus } from "@/components/leagues/LeagueStatus";
import { Badge, Card, EmptyState, LinkButton, PageHeader, withParams } from "@/components/ui/core";
import { formatShort } from "@/lib/dates";

export const metadata = { title: "Detalle de liga" };

const shortcuts = [
  { path: "/partidos", label: "Partidos y resultados", icon: Swords },
  { path: "/tabla", label: "Tabla general", icon: ListOrdered },
  { path: "/goleo", label: "Goleadores", icon: Goal },
  { path: "/eliminatorias", label: "Eliminatorias", icon: Trophy },
  { path: "/equipos", label: "Administrar equipos", icon: Shield },
  { path: "/configuracion/reglas", label: "Reglas de la liga", icon: Settings2 },
];

export default async function LigaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const league = await prisma.league.findUnique({ where: { id }, include: { season: true, championTeam: true } });
  if (!league) notFound();
  const [standings, scorers, rounds, teams, goals] = await Promise.all([
    getLeagueStandings(id, { useSnapshot: true }),
    getLeagueScorers(id),
    prisma.round.findMany({
      where: { seasonId: league.seasonId, matches: { some: { leagueId: id } } },
      orderBy: [{ phase: "asc" }, { number: "asc" }],
      select: { id: true, number: true, name: true, phase: true, date: true, matches: { where: { leagueId: id }, select: { status: true } } },
    }),
    prisma.team.findMany({ where: { leagueId: id }, orderBy: { name: "asc" }, select: { id: true, name: true, active: true, _count: { select: { players: true } } } }),
    prisma.matchResult.aggregate({
      where: { match: { leagueId: id, status: "JUGADO" } },
      _sum: { homeGoals: true, awayGoals: true },
      _count: true,
    }),
  ]);
  const totalGoals = (goals._sum.homeGoals ?? 0) + (goals._sum.awayGoals ?? 0);
  const activeTeamCount = teams.filter((team) => team.active).length;
  const hasResults = standings.rows.some((row) => row.jj > 0);
  const positions = new Map(standings.rows.map((row) => [row.teamId, leagueStandingPosition(row, hasResults)]));
  const leader = standings.rows[0];
  const leaderLabel = !hasResults || !leader ? "Sin resultados" : leader.unresolvedTieGroup != null ? "Por desempatar" : leader.teamName;
  const leadingScorers = scorers.rows.filter((row) => row.position === 1);
  const scorerLabel = leadingScorers.length > 1 ? `${leadingScorers.length} jugadores comparten el primer lugar de goleo (${leadingScorers[0].goals} goles).`
    : leadingScorers.length === 1 ? `Goleador: ${leadingScorers[0].playerName} (${leadingScorers[0].goals} goles).` : "Aún no hay goles individuales registrados.";

  return <>
    <PageHeader breadcrumb={[{ href: "/ligas", label: "Ligas" }]} title={<span className="break-words">{league.name}</span>}
      description="Consulta la actividad de la liga y encuentra cada sección de la competencia."
      actions={<LinkButton href="/ligas" variant="secondary">Volver a Ligas</LinkButton>} />

    <section aria-label="Resumen de la liga" className="mb-5 overflow-hidden rounded-xl border border-slate-300 bg-white">
      <div className="bg-sport flex flex-wrap items-start justify-between gap-4 border-l-4 border-orange-400 px-5 py-5 text-white sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold break-words">{league.season.name}</h2>
          {league.championTeam ? <p className="mt-2 flex items-start gap-2 text-sm text-orange-100"><Trophy className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" aria-hidden /><span className="min-w-0 break-words"><strong>Campeón:</strong> {league.championTeam.name}</span></p>
          : <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100">{standings.frozen ? "La clasificación de la fase regular está cerrada. Consulta los cruces en Eliminatorias." : "Los resultados oficiales actualizan la tabla de la fase regular."}</p>}
        </div>
        <div className="flex flex-wrap gap-2"><LeaguePhase hasChampion={!!league.championTeam} hasSnapshot={standings.frozen} /><LeagueStatus active={league.active} /></div>
      </div>
      <dl className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
        <div><dt className="text-xs font-semibold text-slate-600">Equipos activos</dt><dd className="mt-1 text-2xl font-bold text-[#102d50] tabular-nums">{activeTeamCount}</dd><dd className="mt-1 text-xs text-slate-500">{teams.length} registrados en total</dd></div>
        <div><dt className="text-xs font-semibold text-slate-600">Partidos disputados</dt><dd className="mt-1 text-2xl font-bold text-[#102d50] tabular-nums">{goals._count}</dd><dd className="mt-1 text-xs text-slate-500">Con resultado registrado</dd></div>
        <div><dt className="text-xs font-semibold text-slate-600">Goles en tiempo regular</dt><dd className="mt-1 text-2xl font-bold text-[#102d50] tabular-nums">{totalGoals}</dd><dd className="mt-1 text-xs text-slate-500">{goals._count ? `${(totalGoals / goals._count).toFixed(2)} por partido` : "Sin resultados registrados"}</dd></div>
        <div className="min-w-0"><dt className="text-xs font-semibold text-slate-600">Líder de fase regular{standings.frozen ? " · cierre oficial" : ""}</dt><dd className="mt-2 text-base font-bold break-words text-[#102d50]">{leaderLabel}</dd><dd className="mt-2 text-xs leading-relaxed break-words text-slate-600">{scorerLabel}</dd></div>
      </dl>
      <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs leading-relaxed text-slate-600 sm:px-6">Los totales de partidos y goles incluyen los encuentros asignados a esta liga, incluidos amistosos y eliminatorias. Los penales de desempate no suman goles. El liderato y el goleo corresponden a la fase regular.</p>
    </section>

    <nav aria-label="Secciones de esta liga" className="mb-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {shortcuts.map(({ path, label, icon: Icon }) => <Link key={path} href={withParams(path, { liga: id })}
        className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-[#102d50] hover:border-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"><Icon className="h-4 w-4 shrink-0 text-blue-800" aria-hidden /><span>{label}</span></Link>)}
    </nav>

    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Card className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div><h2 className="text-base font-bold text-[#102d50]">Jornadas de la liga</h2><p className="mt-1 text-xs text-slate-600">{rounds.length} {rounds.length === 1 ? "jornada con partidos asignados" : "jornadas con partidos asignados"}</p></div>
          <LinkButton href="/calendario" size="sm" variant="secondary"><CalendarDays className="h-3.5 w-3.5" aria-hidden />Calendario</LinkButton>
        </div>
        {rounds.length === 0 ? <EmptyState title="Todavía no hay jornadas para esta liga" description="Registra sus equipos y prepara la programación de la temporada."
          action={<LinkButton href={activeTeamCount < 2 ? withParams("/equipos", { liga: id }) : "/calendario?seccion=preparar"} variant="secondary">{activeTeamCount < 2 ? "Registrar equipos" : "Preparar calendario"}</LinkButton>} />
        : <>
          <ul className="divide-y divide-slate-200">
            {rounds.map((round) => {
              const played = round.matches.filter((match) => match.status === "JUGADO").length;
              const cancelled = round.matches.filter((match) => match.status === "CANCELADO").length;
              return <li key={round.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0"><Link href={leagueRoundHref(id, round)} className="rounded text-sm font-bold break-words text-blue-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">{roundTitle(round)}</Link><p className="mt-1 text-xs text-slate-600">Fecha de jornada: {formatShort(round.date)}</p></div>
                  <Badge className={played === round.matches.length - cancelled && played > 0 ? "bg-emerald-50 text-emerald-900 ring-emerald-300" : "bg-slate-50 text-slate-700 ring-slate-300"}>{cancelled === round.matches.length ? "Sin partidos vigentes" : `${played} de ${round.matches.length - cancelled} disputados`}</Badge>
                </div>
                {cancelled > 0 && <p className="mt-2 text-xs text-slate-500">{cancelled} {cancelled === 1 ? "partido cancelado" : "partidos cancelados"}</p>}
              </li>;
            })}
          </ul>
          <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs leading-relaxed text-slate-600">Abre una jornada regular para ver sus partidos, aunque hayan cambiado de fecha. Las fases eliminatorias abren el cuadro de esta liga.</p>
        </>}
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div><h2 className="text-base font-bold text-[#102d50]">Equipos participantes</h2><p className="mt-1 text-xs text-slate-600">Jugadores registrados y posición {standings.frozen ? "del cierre oficial" : "en fase regular"}</p></div>
          <LinkButton href={withParams("/equipos", { liga: id })} size="sm" variant="secondary">Administrar</LinkButton>
        </div>
        {teams.length === 0 ? <EmptyState title="Esta liga aún no tiene equipos" description="Registra a los participantes para empezar a organizar sus encuentros."
          action={<LinkButton href={withParams("/equipos", { liga: id })}>Registrar equipos</LinkButton>} />
        : <>
          <ul className="divide-y divide-slate-200">
            {teams.map((team) => <li key={team.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><Link href={`/equipos/${team.id}`} className="min-w-0 rounded text-sm font-bold break-words text-blue-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">{team.name}</Link><Badge className={team.active ? "bg-emerald-50 text-emerald-900 ring-emerald-300" : "bg-slate-100 text-slate-600 ring-slate-300"}>{team.active ? "Activo" : "Baja"}</Badge></div>
              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs"><div className="flex gap-1.5"><dt className="text-slate-500">Jugadores:</dt><dd className="font-semibold text-slate-700 tabular-nums">{team._count.players}</dd></div><div className="flex gap-1.5"><dt className="text-slate-500">Posición:</dt><dd className="font-semibold text-slate-700">{positions.get(team.id) ?? "Sin posición"}</dd></div></dl>
            </li>)}
          </ul>
          <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs leading-relaxed text-slate-600">Las posiciones de fase regular pendientes de desempate se indican sin asignar un lugar definitivo. Consulta la <Link href={withParams("/tabla", { liga: id })} className="rounded font-semibold text-blue-800 underline focus-visible:outline-2 focus-visible:outline-blue-700">Tabla general</Link> para ver el detalle.</p>
        </>}
      </Card>
    </div>
  </>;
}
