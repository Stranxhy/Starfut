import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { addServingAction, removeServingAction, updateSanctionAction } from "@/server/actions/sanctions";
import { SanctionEditForm, ServingForm } from "@/components/forms/SanctionForm";
import { SanctionProgress } from "@/components/sanctions/SanctionProgress";
import { ConfirmAction } from "@/components/ui/form";
import { Badge, Card, Collapsible, EmptyState, LinkButton, PageHeader } from "@/components/ui/core";
import { AuditList } from "@/components/AuditList";
import { sanctionFollowUp } from "@/domain/sanctions-view";
import { formatLong, formatShort, toISODate } from "@/lib/dates";
import { SANCTION_STATUS } from "@/lib/labels";
import { loadSanctionFormData } from "../data";

export const metadata = { title: "Ficha de sanción" };
const linkClass = "rounded font-semibold text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const matchInclude = { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } } as const;

export default async function SancionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const sanction = await prisma.sanction.findUnique({ where: { id }, include: {
    season: { select: { name: true } },
    player: { select: { id: true, fullName: true, teamId: true, team: { select: { id: true, name: true } } } },
    team: { select: { id: true, name: true, active: true, league: { select: { name: true } } } },
    type: true, unit: true,
    match: { include: matchInclude },
    servings: { include: { match: { include: matchInclude } }, orderBy: [{ date: "desc" }, { id: "asc" }] },
  } });
  if (!sanction) notFound();
  const progress = sanctionFollowUp(sanction.unit.kind, sanction.duration, sanction.servings.length, sanction.status);
  const [formData, teamMatches] = await Promise.all([
    loadSanctionFormData(sanction.seasonId, { typeId: sanction.typeId, unitId: sanction.unitId, matchId: sanction.matchId }),
    progress.canRegister ? prisma.match.findMany({ where: {
      seasonId: sanction.seasonId,
      OR: [{ homeTeamId: sanction.teamId }, { awayTeamId: sanction.teamId }],
      status: { not: "CANCELADO" }, date: { gte: sanction.date },
      id: { notIn: sanction.servings.map((entry) => entry.matchId).filter((matchId): matchId is string => !!matchId) },
    }, orderBy: [{ date: "asc" }, { id: "asc" }], select: { id: true, date: true, ...matchInclude }, take: 30 }) : [],
  ]);

  return <>
    <PageHeader breadcrumb={[{ href: "/sanciones", label: "Sanciones" }]} title={<span className="break-words">{sanction.player.fullName}</span>}
      description="Revisa el motivo, registra el cumplimiento y consulta los cambios de esta sanción."
      actions={<><LinkButton href={`/jugadores/${sanction.playerId}`} variant="secondary">Ver jugador</LinkButton><LinkButton href="/sanciones" variant="secondary">Volver a Sanciones</LinkButton></>} />
    <section aria-label="Identificación de la sanción" className="bg-sport mb-5 flex flex-wrap items-start justify-between gap-4 rounded-xl border-l-4 border-orange-400 px-5 py-5 text-white sm:px-6">
      <div className="min-w-0"><p className="text-xs text-blue-100">{sanction.season.name}</p><h2 className="mt-1 text-xl font-bold break-words">{sanction.type.name}</h2><p className="mt-2 text-sm text-blue-100">Registrada el {formatLong(sanction.date, false)}</p></div>
      <Badge className={SANCTION_STATUS[sanction.status].className}>{SANCTION_STATUS[sanction.status].label}</Badge>
    </section>

    <div className="mb-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Card className="min-w-0 p-5 sm:p-6" aria-labelledby="motivo-title">
        <h2 id="motivo-title" className="text-base font-bold text-[#102d50]">Motivo de la sanción</h2>
        <p className="mt-3 max-w-prose text-sm leading-relaxed whitespace-pre-line break-words text-slate-700">{sanction.reason}</p>
        <div className="mt-5 border-t border-slate-200 pt-4"><h3 className="text-sm font-semibold text-[#102d50]">Observaciones</h3><p className="mt-2 max-w-prose text-sm leading-relaxed whitespace-pre-line break-words text-slate-600">{sanction.notes || "Sin observaciones adicionales."}</p></div>
      </Card>
      <Card className="min-w-0 p-5 sm:p-6" aria-labelledby="contexto-title">
        <h2 id="contexto-title" className="text-base font-bold text-[#102d50]">Equipo y partido</h2>
        <dl className="mt-4 space-y-4 text-sm">
          <div><dt className="text-xs font-semibold text-slate-600">Equipo de la sanción</dt><dd className="mt-1 break-words"><Link href={`/equipos/${sanction.teamId}`} className={linkClass}>{sanction.team.name}</Link></dd><dd className="mt-1 text-xs break-words text-slate-600">{sanction.team.league.name}{!sanction.team.active && " · Equipo dado de baja"}</dd></div>
          <div><dt className="text-xs font-semibold text-slate-600">Partido relacionado</dt><dd className="mt-1 break-words">{sanction.match ? <Link href={`/partidos/${sanction.match.id}`} className={linkClass}>{sanction.match.homeTeam.name} vs {sanction.match.awayTeam.name}</Link> : <span className="text-slate-600">Sin partido relacionado</span>}</dd>{sanction.match && <dd className="mt-1 text-xs text-slate-600">{sanction.match.date ? formatShort(sanction.match.date) : "Sin fecha"}</dd>}</div>
        </dl>
        {sanction.player.teamId !== sanction.teamId && <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-900">El jugador ahora pertenece a <Link href={`/equipos/${sanction.player.teamId}`} className="rounded font-semibold underline focus-visible:outline-2 focus-visible:outline-blue-700">{sanction.player.team.name}</Link>. Esta sanción conserva su equipo original.</p>}
      </Card>
    </div>

    <Card aria-labelledby="cumplimiento-title" className="overflow-hidden">
      <div className="grid gap-4 border-b border-slate-200 bg-slate-50 px-5 py-5 sm:px-6 lg:grid-cols-2">
        <div><h2 id="cumplimiento-title" className="text-base font-bold text-[#102d50]">Seguimiento del cumplimiento</h2><p className="mt-2 text-sm font-semibold break-words text-slate-700">Duración: {sanction.duration} {sanction.unit.name.toLowerCase()}</p><p className="mt-2 max-w-prose text-xs leading-relaxed text-slate-600">{progress.guidance}</p></div>
        <div className="min-w-0 self-center rounded-lg border border-slate-300 bg-white p-4"><SanctionProgress kind={sanction.unit.kind} duration={sanction.duration} served={sanction.servings.length} status={sanction.status} /></div>
      </div>
      <div className={`grid items-start ${progress.canRegister ? "xl:grid-cols-2" : ""}`}>
        {progress.canRegister && <div className="min-w-0 border-b border-slate-200 p-5 sm:p-6 xl:border-r xl:border-b-0"><h3 className="mb-4 text-sm font-bold text-[#102d50]">Registrar cumplimiento</h3><ServingForm action={addServingAction} sanctionId={sanction.id} matches={teamMatches.map((match) => ({ value: match.id, label: `${formatShort(match.date)} · ${match.homeTeam.name} vs ${match.awayTeam.name}` }))} /></div>}
        <div className="min-w-0"><div className="border-b border-slate-200 px-5 py-4 sm:px-6"><h3 className="text-sm font-bold text-[#102d50]">Historial de cumplimiento</h3><p className="mt-1 text-xs text-slate-600">{sanction.servings.length} {sanction.servings.length === 1 ? "registro" : "registros"} · más recientes primero</p></div>
          {sanction.servings.length === 0 ? <EmptyState title="Sin cumplimientos registrados" description={progress.canRegister ? "Registra el primer cumplimiento con un partido o una fecha." : "Esta sanción no tiene registros de cumplimiento."} />
          : <ol className="divide-y divide-slate-200">{sanction.servings.map((entry) => <li key={entry.id} className="px-5 py-4 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-bold text-[#102d50]">{formatLong(entry.date, false)}</p><ConfirmAction action={removeServingAction} hidden={{ id: entry.id }} label="Eliminar registro" title="Eliminar cumplimiento" description="Se quitará este registro y se recalculará el cumplimiento según la unidad de la sanción. Indica el motivo para conservarlo en el historial de cambios." reason="required" confirmLabel="Eliminar registro" /></div><p className="mt-2 text-sm break-words">{entry.match ? <Link href={`/partidos/${entry.match.id}`} className={linkClass}>{entry.match.homeTeam.name} vs {entry.match.awayTeam.name}</Link> : <span className="text-slate-600">Registrado por fecha, sin partido</span>}</p>{entry.notes && <p className="mt-2 text-sm leading-relaxed whitespace-pre-line break-words text-slate-600">{entry.notes}</p>}</li>)}</ol>}
        </div>
      </div>
    </Card>
    <div className="mt-5 space-y-4">
      <Collapsible title="Editar sanción"><div className="p-4 sm:p-5"><SanctionEditForm key={sanction.updatedAt.toISOString()} action={updateSanctionAction} data={formData} sanction={{ id: sanction.id, playerId: sanction.playerId, teamId: sanction.teamId, matchId: sanction.matchId ?? "", date: toISODate(sanction.date)!, typeId: sanction.typeId, unitId: sanction.unitId, duration: String(sanction.duration), status: sanction.status, reason: sanction.reason, notes: sanction.notes ?? "" }} /></div></Collapsible>
      <Collapsible title="Historial de cambios"><AuditList entity="Sanción" entityId={sanction.id} /></Collapsible>
    </div>
  </>;
}
