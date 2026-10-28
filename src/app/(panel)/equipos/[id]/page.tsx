import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, FileDown, Settings2, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { getLeagueStandings } from "@/server/services/standings";
import { MATCH_INCLUDE, sortMatches } from "@/server/services/matches";
import { leagueStandingPosition } from "@/domain/leagues-view";
import { addTeamRestrictionAction, deleteTeamRestrictionAction, setTeamActiveAction, updateTeamAction, uploadTeamLogoAction } from "@/server/actions/teams";
import { createPlayerAction } from "@/server/actions/people";
import { DeactivateTeamButton, LogoForm, PlayerCreateButton, SimpleToggleForm, TeamEditForm } from "@/components/forms/entity-forms";
import { RestrictionForm } from "@/components/forms/RestrictionForm";
import { Alert, Badge, Card, Collapsible, EmptyState, LinkButton, PageHeader, withParams } from "@/components/ui/core";
import { TeamCrest, TeamStatus } from "@/components/teams/TeamIdentity";
import { TeamMatches } from "@/components/teams/TeamMatches";
import { AuditList } from "@/components/AuditList";
import { formatShort } from "@/lib/dates";

export const metadata = { title: "Ficha de equipo" };

export default async function EquipoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const team = await prisma.team.findUnique({ where: { id }, include: {
    league: true,
    season: { include: { leagues: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }, timeSlots: { orderBy: { startTime: "asc" } } } },
    players: { orderBy: [{ active: "desc" }, { fullName: "asc" }] },
    restrictions: { include: { timeSlot: true }, orderBy: { createdAt: "desc" } },
  } });
  if (!team) notFound();
  const [standings, matches, goalsByPlayer, sanctions] = await Promise.all([
    getLeagueStandings(team.leagueId),
    prisma.match.findMany({ where: { OR: [{ homeTeamId: id }, { awayTeamId: id }] }, include: MATCH_INCLUDE }),
    prisma.matchScorer.groupBy({ by: ["playerId"], where: { teamId: id, match: { status: "JUGADO", type: { not: "AMISTOSO" } } }, _sum: { goals: true } }),
    prisma.sanction.count({ where: { teamId: id, status: { in: ["ACTIVA", "PENDIENTE", "EN_REVISION"] } } }),
  ]);
  const row = standings.rows.find((item) => item.teamId === id);
  const sorted = sortMatches(matches);
  const played = sorted.filter((match) => match.status === "JUGADO").reverse();
  const upcoming = sorted.filter((match) => match.status !== "JUGADO" && match.status !== "CANCELADO");
  const goalsMap = new Map(goalsByPlayer.map((item) => [item.playerId, item._sum.goals ?? 0]));
  const activePlayers = team.players.filter((player) => player.active).length;
  const leagueOpts = team.season.leagues.map((league) => ({ value: league.id, label: league.name }));
  const matchesHref = withParams("/partidos", { equipo: id });
  const standingsHref = withParams("/tabla", { liga: team.leagueId, vista: "actual" });

  return <>
    <PageHeader breadcrumb={[{ href: "/equipos", label: "Equipos" }, { href: `/ligas/${team.leagueId}`, label: team.league.name }]}
      title={<span className="break-words">{team.name}</span>} description="Plantilla, partidos y administración del equipo."
      actions={<><LinkButton href={`/api/pdf/estadisticas-equipo?team=${id}`} target="_blank" variant="secondary"><FileDown className="h-4 w-4" aria-hidden />PDF de estadísticas</LinkButton><LinkButton href={withParams("/equipos", { liga: team.leagueId, estado: "todos" })} variant="secondary">Volver a Equipos</LinkButton></>} />
    {!team.active && <Alert tone="warn" className="mb-5" title="Equipo dado de baja">Su historial se conserva. {upcoming.length > 0 && <>{`Tiene ${upcoming.length} partidos pendientes. `}<Link href={matchesHref} className="font-semibold underline">Revisar partidos</Link></>}</Alert>}

    <section aria-label="Resumen deportivo del equipo" className="mb-5 overflow-hidden rounded-xl border border-slate-300 bg-white">
      <div className="bg-sport flex flex-wrap items-center justify-between gap-4 border-l-4 border-orange-400 px-5 py-5 text-white sm:px-6">
        <div className="flex min-w-0 items-center gap-4"><TeamCrest id={team.id} hasLogo={!!team.logo} large /><div className="min-w-0"><p className="text-xs text-blue-100">{team.season.name}</p><h2 className="mt-1 text-xl font-bold break-words">{team.league.name}</h2><p className="mt-2 text-sm text-blue-100">{activePlayers} {activePlayers === 1 ? "jugador activo" : "jugadores activos"} en la plantilla</p></div></div>
        <div className="flex flex-wrap gap-2"><TeamStatus active={team.active} />{team.isDemo && <Badge className="bg-amber-50 text-amber-900 ring-amber-300">Demo</Badge>}</div>
      </div>
      <dl className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
        <div><dt className="text-xs font-semibold text-slate-600">Posición en fase regular</dt><dd className="mt-2 text-xl font-bold text-[#102d50]"><Link href={standingsHref} className="rounded hover:underline focus-visible:outline-2 focus-visible:outline-blue-700">{leagueStandingPosition(row, standings.rows.some((item) => item.jj > 0))}</Link></dd><dd className="mt-2 text-xs text-slate-600">{row?.pts ?? 0} puntos</dd></div>
        <div><dt className="text-xs font-semibold text-slate-600">Partidos de fase regular</dt><dd className="mt-1 text-2xl font-bold text-[#102d50] tabular-nums">{row?.jj ?? 0}</dd><dd className="mt-2 text-xs leading-relaxed text-slate-600">{row?.jg ?? 0} ganados · {row?.jp ?? 0} perdidos<br />Desempates: {row?.eg ?? 0} ganados, {row?.ep ?? 0} perdidos{row && row.e > 0 ? <><br />{row.e} empates definitivos</> : null}</dd></div>
        <div><dt className="text-xs font-semibold text-slate-600">Goles de fase regular</dt><dd className="mt-1 text-2xl font-bold text-[#102d50] tabular-nums">{row?.gf ?? 0} <span className="text-xs font-medium text-slate-600">a favor</span></dd><dd className="mt-2 text-xs text-slate-600">{row?.ge ?? 0} en contra · Diferencia {row?.dif ?? 0}</dd></div>
        <div><dt className="text-xs font-semibold text-slate-600">Sanciones por atender</dt><dd className="mt-1 text-2xl font-bold tabular-nums"><Link href={withParams("/sanciones", { equipo: id })} className={`rounded hover:underline focus-visible:outline-2 focus-visible:outline-blue-700 ${sanctions ? "text-amber-800" : "text-[#102d50]"}`}>{sanctions}</Link></dd><dd className="mt-2 text-xs leading-relaxed text-slate-600">Activas, pendientes y en revisión</dd></div>
      </dl>
      <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs leading-relaxed text-slate-600 sm:px-6">La posición, los puntos y los goles se calculan con los resultados oficiales actuales de fase regular. Los amistosos y las eliminatorias no se incluyen en esas cifras.</p>
    </section>

    <nav aria-label="Secciones de la ficha" className="mb-5 grid gap-2 sm:grid-cols-3">
      {[{ id: "plantilla", label: "Plantilla", icon: Users }, { id: "partidos-equipo", label: "Partidos", icon: CalendarDays }, { id: "datos-equipo", label: "Datos y disponibilidad", icon: Settings2 }].map(({ id: sectionId, label, icon: Icon }) => <a key={sectionId} href={`#${sectionId}`} className="flex min-h-12 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-[#102d50] hover:border-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"><Icon className="h-4 w-4 shrink-0" aria-hidden />{label}</a>)}
    </nav>

    <Card id="plantilla" aria-labelledby="plantilla-title" className="scroll-mt-20 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div><h2 id="plantilla-title" className="text-base font-bold text-[#102d50]">Plantilla del equipo</h2><p className="mt-1 text-xs text-slate-600">{activePlayers} activos · {team.players.length - activePlayers} inactivos</p></div>
        <PlayerCreateButton action={createPlayerAction} teams={[{ value: team.id, label: team.name }]} defaultTeamId={team.id} />
      </div>
      {team.players.length === 0 ? <EmptyState title="Registra a los primeros jugadores" description="Agrega sus nombres y números de camiseta. Aquí podrás abrir sus fichas y consultar los goles anotados con este equipo." />
      : <table className="w-full table-fixed border-collapse text-sm">
        <caption className="sr-only">Jugadores de {team.name}. Goles anotados con este equipo, excluyendo amistosos.</caption>
        <thead><tr className="border-b border-slate-300 bg-slate-100 text-xs font-bold text-slate-600"><th scope="col" className="px-4 py-3 text-left sm:px-5">Jugador</th><th scope="col" className="w-20 px-2 py-3 text-center">Goles</th><th scope="col" className="hidden w-28 px-4 py-3 text-center sm:table-cell">Estado</th></tr></thead>
        <tbody>{team.players.map((player, index) => <tr key={player.id} className={`border-b border-slate-200 last:border-0 hover:bg-blue-50/60 ${index % 2 ? "bg-slate-50" : "bg-white"}`}>
          <th scope="row" className="px-4 py-4 text-left font-normal sm:px-5"><div className="flex items-start gap-3"><span className="inline-flex min-h-8 min-w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-1 text-xs font-bold text-slate-600 tabular-nums"><span className="sr-only">Camiseta </span>{player.jerseyNumber ?? "—"}</span><div className="min-w-0"><Link href={`/jugadores/${player.id}`} className="rounded font-bold break-words text-[#102d50] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">{player.fullName}</Link><p className="mt-1 text-xs text-slate-600 sm:hidden">{player.active ? "Activo" : "Inactivo"}</p></div></div></th>
          <td className="px-2 py-4 text-center text-lg font-bold text-[#102d50] tabular-nums">{goalsMap.get(player.id) ?? 0}</td>
          <td className="hidden px-4 py-4 text-center sm:table-cell"><Badge className={player.active ? "bg-emerald-50 text-emerald-900 ring-emerald-300" : "bg-slate-100 text-slate-600 ring-slate-300"}>{player.active ? "Activo" : "Inactivo"}</Badge></td>
        </tr>)}</tbody>
      </table>}
      <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs leading-relaxed text-slate-600">Los goles individuales incluyen fase regular y eliminatorias disputadas con este equipo. Los amistosos y los penales de desempate no suman. Los jugadores transferidos se consultan en su ficha e historial.</p>
    </Card>

    <section id="partidos-equipo" aria-labelledby="partidos-title" className="mt-6 scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 id="partidos-title" className="text-lg font-bold text-[#102d50]">Partidos del equipo</h2><LinkButton href={matchesHref} variant="secondary" size="sm">Ver todos los partidos</LinkButton></div>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card className="min-w-0 overflow-hidden"><div className="border-b border-slate-200 px-5 py-4"><h3 className="text-sm font-bold text-[#102d50]">Encuentros pendientes</h3><p className="mt-1 text-xs text-slate-600">{upcoming.length} por disputar · ordenados por fecha</p></div>
          {upcoming.length === 0 ? <EmptyState title="Sin partidos pendientes" description="Los próximos encuentros aparecerán aquí cuando se programe el calendario." action={<LinkButton href="/calendario" variant="secondary">Ir al calendario</LinkButton>} /> : <TeamMatches matches={upcoming} label="Encuentros pendientes del equipo" />}
        </Card>
        <Card className="min-w-0 overflow-hidden"><div className="border-b border-slate-200 px-5 py-4"><h3 className="text-sm font-bold text-[#102d50]">Historial de partidos</h3><p className="mt-1 text-xs text-slate-600">{played.length} disputados · más recientes primero</p></div>
          {played.length === 0 ? <EmptyState title="Todavía no hay partidos disputados" description="Al registrar resultados, podrás consultar los marcadores y sus detalles aquí." /> : <TeamMatches matches={played} label="Historial de partidos del equipo" />}
        </Card>
      </div>
    </section>

    <section id="datos-equipo" aria-labelledby="datos-title" className="mt-6 scroll-mt-20 space-y-4">
      <h2 id="datos-title" className="text-lg font-bold text-[#102d50]">Datos y disponibilidad</h2>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><h3 className="text-sm font-bold text-[#102d50]">Contacto del equipo</h3><DeactivateTeamButton action={setTeamActiveAction} teamId={id} active={team.active} /></div>
        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-3">{[{ label: "Responsable", value: team.contactName }, { label: "Teléfono", value: team.contactPhone }, { label: "Correo", value: team.contactEmail }].map(({ label, value }) => <div key={label} className="min-w-0"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 text-sm break-words text-slate-800">{value || "Sin registrar"}</dd></div>)}</dl>
        {team.notes && <div className="border-t border-slate-200 px-5 py-4"><h4 className="text-xs font-semibold text-slate-500">Observaciones</h4><p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap break-words text-slate-700">{team.notes}</p></div>}
      </Card>
      <Collapsible title="Editar datos y escudo del equipo">
        <div className="space-y-6 p-4 sm:p-5"><TeamEditForm action={updateTeamAction} leagues={leagueOpts} team={{ id: team.id, name: team.name, leagueId: team.leagueId, contactName: team.contactName, contactPhone: team.contactPhone, contactEmail: team.contactEmail, notes: team.notes }} />
          <div className="border-t border-slate-200 pt-5"><h3 className="mb-3 text-sm font-bold text-[#102d50]">Escudo del equipo</h3><LogoForm action={uploadTeamLogoAction} teamId={team.id} hasLogo={!!team.logo} /></div>
        </div>
      </Collapsible>
      <Collapsible title={`Restricciones de disponibilidad (${team.restrictions.length})`}>
        <div className="p-4 sm:p-5"><p className="mb-4 text-sm leading-relaxed text-slate-600">Indica las fechas u horarios en los que el equipo no puede jugar. Sin fecha, la restricción se aplica siempre a ese horario.</p><RestrictionForm action={addTeamRestrictionAction} teamId={team.id} slots={team.season.timeSlots.map((slot) => ({ value: slot.id, label: slot.startTime }))} /></div>
        {team.restrictions.length > 0 ? <ul className="divide-y divide-slate-200 border-t border-slate-200">{team.restrictions.map((restriction) => <li key={restriction.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div className="min-w-0"><p className="text-sm font-semibold text-[#102d50]">{restriction.date ? formatShort(restriction.date) : "Todas las fechas"} · {restriction.timeSlot?.startTime ?? "Todo el día"}</p><p className="mt-1 text-xs break-words text-slate-600">{restriction.reason || "Sin motivo registrado"}</p></div><SimpleToggleForm action={deleteTeamRestrictionAction} hidden={{ id: restriction.id }} label="Eliminar" variant="danger" /></li>)}</ul> : <p className="border-t border-slate-200 px-5 py-4 text-sm text-slate-500">Este equipo no tiene restricciones registradas.</p>}
      </Collapsible>
      <Collapsible title="Historial de cambios"><AuditList entity="Equipo" entityId={team.id} /></Collapsible>
    </section>
  </>;
}
