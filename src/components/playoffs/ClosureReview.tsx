import Link from "next/link";
import { AlertCircle, CheckCircle2, CircleX } from "lucide-react";
import type { getClosureReview } from "@/server/services/playoffs";
import { closeRegularPhaseAction } from "@/server/actions/playoffs";
import { CloseRegularPhaseForm } from "@/components/forms/playoff-forms";
import { Card, CardHeader, LinkButton } from "@/components/ui/core";
import { StatusBadge } from "@/components/match-ui";
import { formatShort } from "@/lib/dates";

export function ClosureReview({ review }: { review: Awaited<ReturnType<typeof getClosureReview>> }) {
  const leagueId = review.league.id;
  const configHref = `/configuracion/eliminatorias?liga=${leagueId}`;
  const hasIssues = review.pending.length > 0 || review.missingRounds.length > 0 || review.cancelledWithoutReplacement.length > 0;
  const nameById = new Map(review.standings.rows.map((row) => [row.teamId, row.teamName]));
  const checks = [
    { label: "Jornadas programadas", detail: `${review.roundsConfigured - review.missingRounds.length} de ${review.roundsConfigured} tienen partidos`, pending: review.missingRounds.length > 0, href: "/calendario", action: "Ver calendario" },
    { label: "Resultados oficiales", detail: `${review.pending.length} partidos sin resultado`, pending: review.pending.length > 0, href: `#partidos-pendientes`, action: "Ver pendientes" },
    { label: "Partidos cancelados", detail: `${review.cancelledWithoutReplacement.length} sin reprogramar o sustituir`, pending: review.cancelledWithoutReplacement.length > 0, href: `/partidos?liga=${leagueId}&estado=CANCELADO`, action: "Revisar partidos" },
    { label: "Desempates", detail: `${review.relevantGroups.length} grupos requieren una decisión oficial al cerrar`, pending: review.relevantGroups.length > 0, href: `/tabla?liga=${leagueId}`, action: "Ver clasificación" },
    { label: "Formato del cuadro", detail: review.bracketErrors.length ? `${review.bracketErrors.length} observaciones impiden el cierre` : `Compatible con los ${review.standings.rows.length} equipos de la clasificación`, pending: review.bracketErrors.length > 0, blocking: true, href: configHref, action: "Ajustar cuadro" },
    { label: "Cruces oficiales", detail: review.officialConfirmed ? "Confirmados contra el cuadro de la liga" : "Falta confirmar los cruces en la configuración", pending: !review.officialConfirmed, href: configHref, action: "Revisar cruces" },
  ];
  const pendingCount = checks.filter((check) => check.pending).length;

  return (
    <Card className="min-w-0">
      <CardHeader title="Revisión antes del cierre" description={pendingCount ? `${pendingCount} aspectos por revisar. Abre cada detalle para resolverlo.` : "La revisión no detecta pendientes. Confirma la clasificación antes de cerrar."} />
      <ul className="divide-y divide-slate-200 px-5">
        {checks.map((check) => {
          const Icon = check.pending ? check.blocking ? CircleX : AlertCircle : CheckCircle2;
          return <li key={check.label} className="flex items-start gap-3 py-3.5">
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${check.pending ? check.blocking ? "text-red-700" : "text-amber-700" : "text-emerald-700"}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{check.label}<span className="sr-only">: {check.pending ? check.blocking ? "Bloquea el cierre" : "Por revisar" : "Sin pendientes"}</span></p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{check.detail}</p>
              {check.pending && <Link href={check.href} className="mt-1 inline-flex min-h-8 items-center rounded text-xs font-semibold text-blue-800 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-blue-700">{check.action}</Link>}
            </div>
          </li>;
        })}
      </ul>
      {(review.missingRounds.length > 0 || review.bracketErrors.length > 0) && (
        <details className="mx-5 mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-amber-950 focus-visible:outline-2 focus-visible:outline-blue-700">Ver observaciones de calendario y cuadro</summary>
          {review.missingRounds.length > 0 && <p className="mt-3 text-xs leading-relaxed text-slate-700">Jornadas sin partidos: {review.missingRounds.join(", ")}.</p>}
          {review.bracketErrors.length > 0 && <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-relaxed text-slate-700">{review.bracketErrors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
        </details>
      )}
      {review.pending.length > 0 && (
        <details id="partidos-pendientes" className="mx-5 mb-4 scroll-mt-20 rounded-lg border border-slate-300 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-blue-900 focus-visible:outline-2 focus-visible:outline-blue-700">Partidos sin resultado ({review.pending.length})</summary>
          <ul className="mt-3 max-h-64 space-y-3 overflow-y-auto text-sm">
            {review.pending.map((match) => <li key={match.id} className="space-y-1">
              <Link href={match.status === "PENDIENTE" ? `/partidos/${match.id}` : `/resultados/${match.id}`} className="block rounded text-blue-900 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-blue-700">{formatShort(match.date)} · {match.homeTeam.name} vs {match.awayTeam.name}</Link>
              <StatusBadge status={match.status} />
            </li>)}
          </ul>
        </details>
      )}
      <div className="border-t border-slate-200 p-5">
        {review.bracketErrors.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">Para habilitar el cierre, ajusta los cruces al número de equipos de esta liga.</p>
            <LinkButton href={configHref} variant="secondary">Revisar configuración</LinkButton>
          </div>
        ) : (
          <details className="rounded-lg border border-slate-300 p-4">
            <summary className="cursor-pointer text-sm font-bold text-[#102d50] focus-visible:outline-2 focus-visible:outline-blue-700">Revisar y cerrar fase regular</summary>
            <p className="mt-3 mb-4 text-sm leading-relaxed text-slate-600">Al confirmar, se guarda la clasificación final y se asignan los participantes del cuadro. Resuelve aquí los desempates que requieran una decisión oficial.</p>
            <CloseRegularPhaseForm action={closeRegularPhaseAction} leagueId={leagueId} hasIssues={hasIssues}
              groups={review.relevantGroups.map((group) => ({ index: group.index, positions: group.positions, teams: group.teamIds.map((id) => ({ id, name: nameById.get(id) ?? id })) }))} />
          </details>
        )}
      </div>
    </Card>
  );
}
