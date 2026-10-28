import Link from "next/link";
import { notFound } from "next/navigation";
import { Goal, History, ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { setPlayerActiveAction, transferPlayerAction, updatePlayerAction } from "@/server/actions/people";
import { playerGoalSummary } from "@/domain/players-view";
import { roundTitle } from "@/domain/calendar";
import { PlayerEditForm, SimpleToggleForm, TransferPlayerButton } from "@/components/forms/entity-forms";
import { PlayerStatus } from "@/components/players/PlayerIdentity";
import { TeamCrest } from "@/components/teams/TeamIdentity";
import { Alert, Badge, Card, Collapsible, EmptyState, LinkButton, PageHeader, withParams } from "@/components/ui/core";
import { TypeBadge } from "@/components/match-ui";
import { AuditList } from "@/components/AuditList";
import { formatDateTime, formatShort } from "@/lib/dates";
import { SANCTION_STATUS } from "@/lib/labels";

export const metadata = { title: "Ficha de jugador" };

export default async function JugadorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const player = await prisma.player.findUnique({ where: { id }, include: {
    season: { select: { name: true } },
    team: { select: { id: true, name: true, active: true, logoMime: true, league: { select: { name: true } } } },
    history: { include: { team: { select: { id: true, name: true } } }, orderBy: [{ fromDate: "desc" }, { id: "asc" }] },
    goals: { include: {
      team: { select: { id: true, name: true } },
      match: { include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } }, round: { select: { number: true, phase: true, name: true } } } },
    } },
    sanctions: { include: { team: { select: { id: true, name: true } }, type: true, unit: true, _count: { select: { servings: true } } }, orderBy: { date: "desc" } },
  } });
  if (!player) notFound();
  const teams = await prisma.team.findMany({ where: { seasonId: player.seasonId, active: true, id: { not: player.teamId } }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, league: { select: { name: true } } } });
  const summary = playerGoalSummary(player.goals);
  const pendingSanctions = player.sanctions.filter((sanction) => ["ACTIVA", "PENDIENTE", "EN_REVISION"].includes(sanction.status)).length;

  return <>
    <PageHeader breadcrumb={[{ href: "/jugadores", label: "Jugadores" }]} title={<span className="break-words">{player.fullName}</span>}
      description="Consulta sus goles, sanciones y trayectoria durante la temporada."
      actions={<><LinkButton href={`/equipos/${player.teamId}`} variant="secondary">Ver equipo actual</LinkButton><LinkButton href={withParams("/jugadores", { equipo: player.teamId, estado: "todos" })} variant="secondary">Volver a Jugadores</LinkButton></>} />
    {!player.active && <Alert tone="warn" title="Jugador inactivo" className="mb-5">Sus goles, sanciones y trayectoria siguen disponibles para consulta. Puedes reactivarlo en Datos y trayectoria.</Alert>}

    <section aria-label="Resumen del jugador" className="mb-5 overflow-hidden rounded-xl border border-slate-300 bg-white">
      <div className="bg-sport flex flex-wrap items-center justify-between gap-4 border-l-4 border-orange-400 px-5 py-5 text-white sm:px-6">
        <div className="flex min-w-0 items-center gap-4"><TeamCrest id={player.teamId} hasLogo={!!player.team.logoMime} large /><div className="min-w-0"><p className="text-xs text-blue-100">{player.season.name}</p><h2 className="mt-1 text-xl font-bold break-words"><Link href={`/equipos/${player.teamId}`} className="rounded hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{player.team.name}</Link></h2><p className="mt-2 text-sm break-words text-blue-100">{player.team.league.name}{!player.team.active && " · Equipo dado de baja"}</p></div></div>
        <div className="flex flex-wrap items-center gap-3"><span className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold">{player.jerseyNumber === null ? "Sin camiseta asignada" : `Camiseta ${player.jerseyNumber}`}</span><PlayerStatus active={player.active} />{player.isDemo && <Badge className="bg-amber-50 text-amber-900 ring-amber-300">Demo</Badge>}</div>
      </div>
      <dl className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
        <div><dt className="text-xs font-semibold text-slate-600">Goles de competencia</dt><dd className="mt-1 text-2xl font-bold text-[#102d50] tabular-nums">{summary.competitionGoals}</dd><dd className="mt-2 text-xs text-slate-600">Fase regular y eliminatorias</dd></div>
        <div><dt className="text-xs font-semibold text-slate-600">Partidos con gol</dt><dd className="mt-1 text-2xl font-bold text-[#102d50] tabular-nums">{summary.matchesWithGoal}</dd><dd className="mt-2 text-xs text-slate-600">En competencia, sin amistosos</dd></div>
        <div><dt className="text-xs font-semibold text-slate-600">Goles en amistosos</dt><dd className="mt-1 text-2xl font-bold text-[#102d50] tabular-nums">{summary.friendlyGoals}</dd><dd className="mt-2 text-xs text-slate-600">Se conservan fuera del goleo</dd></div>
        <div><dt className="text-xs font-semibold text-slate-600">Sanciones por atender</dt><dd className={`mt-1 text-2xl font-bold tabular-nums ${pendingSanctions ? "text-amber-800" : "text-[#102d50]"}`}>{pendingSanctions}</dd><dd className="mt-2 text-xs leading-relaxed text-slate-600">Activas, pendientes y en revisión · {player.sanctions.length} en el historial</dd></div>
      </dl>
      <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs leading-relaxed text-slate-600 sm:px-6">Los goles suman los partidos disputados con todos sus equipos de esta temporada. Los penales de desempate no suman goles; “partidos con gol” no representa el total de partidos jugados.</p>
    </section>

    <nav aria-label="Secciones de la ficha del jugador" className="mb-5 grid gap-2 sm:grid-cols-3">
      {[{ id: "goles-jugador", label: "Historial de goles", icon: Goal }, { id: "sanciones-jugador", label: "Sanciones", icon: ShieldAlert }, { id: "trayectoria-jugador", label: "Datos y trayectoria", icon: History }].map(({ id: sectionId, label, icon: Icon }) => <a key={sectionId} href={`#${sectionId}`} className="flex min-h-12 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-[#102d50] hover:border-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"><Icon className="h-4 w-4 shrink-0" aria-hidden />{label}</a>)}
    </nav>

    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Card id="goles-jugador" aria-labelledby="goles-title" className="min-w-0 scroll-mt-20 overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4"><h2 id="goles-title" className="text-base font-bold text-[#102d50]">Historial de goles</h2><p className="mt-1 text-xs text-slate-600">Detalle por partido · más recientes primero</p></div>
        {summary.played.length === 0 ? <EmptyState title="Todavía no hay goles registrados" description="Los goles aparecerán al registrar al jugador como anotador en un resultado. El marcador por sí solo no asigna goles individuales." />
        : <ul className="divide-y divide-slate-200">{summary.played.map((goal) => <li key={goal.id} className="px-5 py-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-600">{goal.match.date ? formatShort(goal.match.date) : "Sin fecha"}{goal.match.round ? ` · ${roundTitle(goal.match.round)}` : ""}</p><TypeBadge type={goal.match.type} counts={goal.match.countsForStandings} /></div>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link href={`/partidos/${goal.matchId}`} className="rounded text-sm font-bold break-words text-[#102d50] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">{goal.match.homeTeam.name} vs {goal.match.awayTeam.name}</Link><p className="mt-2 text-xs text-slate-600">Anotó con <Link href={`/equipos/${goal.team.id}`} className="rounded font-semibold break-words text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-blue-700">{goal.team.name}</Link></p></div><span className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-[#102d50] tabular-nums">{goal.goals} {goal.goals === 1 ? "gol" : "goles"}</span></div>
        </li>)}</ul>}
      </Card>

      <Card id="sanciones-jugador" aria-labelledby="sanciones-title" className="min-w-0 scroll-mt-20 overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4"><h2 id="sanciones-title" className="text-base font-bold text-[#102d50]">Historial de sanciones</h2><p className="mt-1 text-xs text-slate-600">{player.sanctions.length} registradas · incluye cumplidas y canceladas</p></div>
        {player.sanctions.length === 0 ? <EmptyState title="Sin sanciones registradas" description="Aquí podrás consultar el motivo, la duración y el estado de cada sanción del jugador." />
        : <ul className="divide-y divide-slate-200">{player.sanctions.map((sanction) => <li key={sanction.id} className="px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><Link href={`/sanciones/${sanction.id}`} className="min-w-0 rounded text-sm font-bold break-words text-[#102d50] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">{sanction.type.name}</Link><Badge className={SANCTION_STATUS[sanction.status].className}>{SANCTION_STATUS[sanction.status].label}</Badge></div>
          <p className="mt-2 text-xs text-slate-600">{formatShort(sanction.date)} · {sanction.duration} {sanction.unit.name.toLowerCase()}{sanction.unit.kind === "PARTIDOS" && ` (${sanction._count.servings} cumplidos)`}</p>
          <p className="mt-1 text-xs break-words text-slate-600">Equipo: <Link href={`/equipos/${sanction.team.id}`} className="rounded font-semibold text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-blue-700">{sanction.team.name}</Link></p>
          <Link href={`/sanciones/${sanction.id}`} className="mt-3 inline-block rounded text-xs font-semibold text-blue-800 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-blue-700">Ver sanción</Link>
        </li>)}</ul>}
      </Card>
    </div>

    <section id="trayectoria-jugador" aria-labelledby="trayectoria-title" className="mt-6 scroll-mt-20 space-y-4">
      <h2 id="trayectoria-title" className="text-lg font-bold text-[#102d50]">Datos y trayectoria</h2>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><h3 className="text-sm font-bold text-[#102d50]">Equipos del jugador</h3><p className="mt-1 text-xs text-slate-600">Los goles y las sanciones conservan el equipo con el que ocurrieron.</p></div>{teams.length > 0 && <TransferPlayerButton action={transferPlayerAction} playerId={player.id} teams={teams.map((team) => ({ value: team.id, label: `${team.name} (${team.league.name})` }))} />}</div>
        {player.history.length > 0 ? <ol className="divide-y divide-slate-200">{player.history.map((entry) => <li key={entry.id} className="flex items-start gap-3 px-5 py-4"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${entry.toDate ? "bg-slate-300" : "bg-orange-400"}`} aria-hidden /><div className="min-w-0"><Link href={`/equipos/${entry.team.id}`} className="rounded text-sm font-bold break-words text-[#102d50] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">{entry.team.name}</Link>{!entry.toDate && <span className="ml-2 text-xs font-semibold text-blue-800">Actual</span>}<p className="mt-1 text-xs leading-relaxed text-slate-600">Desde {formatDateTime(entry.fromDate)}{entry.toDate ? ` hasta ${formatDateTime(entry.toDate)}` : ""}</p>{entry.reason && <p className="mt-1 text-xs leading-relaxed break-words text-slate-500">{entry.reason}</p>}</div></li>)}</ol>
        : <p className="px-5 py-4 text-sm text-slate-600">Equipo actual: <Link href={`/equipos/${player.teamId}`} className="rounded font-semibold text-blue-800 underline">{player.team.name}</Link>. No hay movimientos de trayectoria registrados.</p>}
        {teams.length === 0 && <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-600">Para cambiarlo de equipo debe existir otro equipo activo en esta temporada.</p>}
      </Card>
      <Collapsible title="Editar nombre y camiseta"><div className="p-4 sm:p-5"><PlayerEditForm action={updatePlayerAction} player={{ id: player.id, fullName: player.fullName, jerseyNumber: player.jerseyNumber }} /></div></Collapsible>
      <Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div className="min-w-0"><h3 className="text-sm font-bold text-[#102d50]">Estado del jugador</h3><p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-600">Al desactivarlo, su historial se conserva y puedes encontrarlo con el filtro Inactivos.</p></div><SimpleToggleForm action={setPlayerActiveAction} hidden={{ id: player.id, active: player.active ? "0" : "1" }} label={player.active ? "Desactivar jugador" : "Activar jugador"} variant={player.active ? "danger" : "secondary"} /></Card>
      <Collapsible title="Historial de cambios"><AuditList entity="Jugador" entityId={player.id} /></Collapsible>
    </section>
  </>;
}
