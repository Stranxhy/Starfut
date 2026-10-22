import Link from "next/link";
import { Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { getBracketView, getClosureReview, suggestStageDate } from "@/server/services/playoffs";
import { closeRegularPhaseAction, generateStageAction, reopenRegularPhaseAction } from "@/server/actions/playoffs";
import { CloseRegularPhaseForm, GenerateStageForm } from "@/components/forms/playoff-forms";
import { ConfirmAction } from "@/components/ui/form";
import { Alert, Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, Table, TD, TH } from "@/components/ui/core";
import { ScoreText, StatusBadge } from "@/components/match-ui";
import { describeSource } from "@/domain/bracket";
import { formatShort } from "@/lib/dates";
import { STAGE_STATUS } from "@/lib/labels";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Eliminatorias" };

export default async function EliminatoriasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx || ctx.leagues.length === 0) return <EmptyState title="Sin ligas configuradas" />;
  const sp = await searchParams;
  const league = ctx.leagues.find((l) => l.id === str(sp.liga)) ?? ctx.leagues[0];
  const review = await getClosureReview(league.id);

  const tabs = (
    <div className="mb-4 flex flex-wrap gap-2">
      {ctx.leagues.map((l) => (
        <Link key={l.id} href={`/eliminatorias?liga=${l.id}`} className={`rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ${l.id === league.id ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-zinc-700 ring-zinc-300 hover:ring-brand-400"}`}>
          {l.name}
        </Link>
      ))}
    </div>
  );

  if (!review.closed) {
    const stageNames = Object.fromEntries(review.bracket.stages.map((s) => [s.code, s.name]));
    const nameById = new Map(review.standings.rows.map((r) => [r.teamId, r.teamName]));
    const hasIssues = review.pending.length > 0 || review.missingRounds.length > 0 || review.cancelledWithoutReplacement.length > 0;
    return (
      <>
        <PageHeader title="Eliminatorias" actions={<LinkButton href={`/api/pdf/eliminatorias?league=${league.id}`} target="_blank" variant="secondary">PDF del cuadro</LinkButton>} />
        {tabs}
        <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
          <Card>
            <CardHeader title="Validación del cierre" description={`${league.name} · fase regular de ${review.roundsConfigured} jornadas`} />
            <ul className="space-y-3 px-5 py-4 text-sm">
              <li className="flex gap-2">{review.missingRounds.length ? "⚠️" : "✅"}<span>Jornadas en calendario: {review.roundsConfigured - review.missingRounds.length} de {review.roundsConfigured}{review.missingRounds.length > 0 && <span className="block text-xs text-amber-800">Sin partidos: {review.missingRounds.join(", ")}</span>}</span></li>
              <li className="flex gap-2">{review.pending.length ? "⚠️" : "✅"}<span>Partidos oficiales sin resultado: {review.pending.length}</span></li>
              <li className="flex gap-2">{review.cancelledWithoutReplacement.length ? "⚠️" : "✅"}<span>Cancelados sin reprogramar o sustituir: {review.cancelledWithoutReplacement.length}</span></li>
              <li className="flex gap-2">{review.relevantGroups.length ? "⚠️" : "✅"}<span>Empates sin resolver que afectan la clasificación: {review.relevantGroups.length}</span></li>
              <li className="flex gap-2">{review.bracketErrors.length ? "❌" : "✅"}<span>Cuadro de eliminatorias válido para {review.standings.rows.length} equipos{review.bracketErrors.map((e) => <span key={e} className="block text-xs text-red-700">{e}</span>)}</span></li>
              <li className="flex gap-2">{review.officialConfirmed ? "✅" : "⚠️"}<span>{review.officialConfirmed ? "Cruces confirmados contra el cuadro oficial" : "Los cruces configurados aún no se confirman contra el cuadro oficial de la liga (Configuración → Eliminatorias)."}</span></li>
            </ul>
            {review.pending.length > 0 && (
              <div className="border-t border-zinc-100 px-5 py-3">
                <p className="mb-1 text-xs font-bold text-zinc-500 uppercase">Partidos pendientes</p>
                <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                  {review.pending.map((m) => (
                    <li key={m.id}><Link href={`/resultados/${m.id}`} className="hover:underline">{formatShort(m.date)} · {m.homeTeam.name} vs {m.awayTeam.name}</Link> <StatusBadge status={m.status} /></li>
                  ))}
                </ul>
              </div>
            )}
            <div className="border-t border-zinc-100 px-5 py-4">
              {review.bracketErrors.length ? (
                <Alert tone="danger">Corrige el cuadro en <Link className="font-semibold underline" href="/configuracion/eliminatorias">Configuración → Eliminatorias</Link> antes de cerrar.</Alert>
              ) : (
                <CloseRegularPhaseForm
                  action={closeRegularPhaseAction}
                  leagueId={league.id}
                  hasIssues={hasIssues}
                  groups={review.relevantGroups.map((g) => ({ index: g.index, positions: g.positions, teams: g.teamIds.map((id) => ({ id, name: nameById.get(id) ?? id })) }))}
                />
              )}
            </div>
          </Card>
          <div className="space-y-5">
            <Card>
              <CardHeader title="Clasificación que se congelará" description="Revisa la tabla final antes de confirmar." actions={<LinkButton href={`/tabla?liga=${league.id}`} size="sm" variant="ghost">Tabla completa</LinkButton>} />
              <Table>
                <thead><tr><TH className="text-center">Pos</TH><TH>Equipo</TH><TH className="text-center">JJ</TH><TH className="text-center">DIF</TH><TH className="text-center">PTS</TH><TH>Zona</TH></tr></thead>
                <tbody>
                  {review.standings.rows.slice(0, 16).map((r) => (
                    <tr key={r.teamId}>
                      <TD className="text-center"><span className="inline-grid h-6 w-6 place-items-center rounded text-xs font-bold" style={{ background: r.zone?.color ?? "#e4e4e7" }}>{r.position}</span></TD>
                      <TD className="font-semibold">{r.teamName}{r.unresolvedTieGroup !== null && <Badge className="ml-2 bg-amber-100 text-amber-900 ring-amber-300">empate</Badge>}</TD>
                      <TD className="text-center">{r.jj}</TD>
                      <TD className="text-center">{r.dif}</TD>
                      <TD className="text-center font-bold">{r.pts}</TD>
                      <TD className="text-xs text-zinc-600">{r.zone?.label ?? "—"}</TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
            <Card>
              <CardHeader title="Cuadro configurado" actions={<LinkButton href="/configuracion/eliminatorias" size="sm" variant="ghost">Configurar</LinkButton>} />
              <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
                {review.bracket.stages.map((s) => (
                  <div key={s.code}>
                    <p className="mb-1 text-xs font-bold text-zinc-500 uppercase">{s.name}</p>
                    <ol className="space-y-1 text-sm">
                      {s.ties.map((t, i) => <li key={i}>{i + 1}. {describeSource(t.home, stageNames)} <span className="text-zinc-400">vs</span> {describeSource(t.away, stageNames)}</li>)}
                    </ol>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </>
    );
  }

  const view = await getBracketView(league.id);
  const playoffMatches = await prisma.match.count({ where: { leagueId: league.id, stage: { not: "REGULAR" } } });
  const suggestions = Object.fromEntries(
    await Promise.all(view.stages.map(async (s) => [s.id, await suggestStageDate(league.id, s.id)] as const)),
  );

  return (
    <>
      <PageHeader
        title="Eliminatorias"
        description={`${league.name} · clasificación congelada el ${view.snapshot?.createdAt.toLocaleDateString("es-MX")}`}
        actions={
          <>
            <LinkButton href={`/api/pdf/eliminatorias?league=${league.id}`} target="_blank">PDF del cuadro</LinkButton>
            <LinkButton href={`/tabla?liga=${league.id}&vista=final`} variant="secondary">Clasificación final</LinkButton>
            {playoffMatches === 0 && (
              <ConfirmAction action={reopenRegularPhaseAction} hidden={{ leagueId: league.id }} label="Reabrir fase regular" title="Reabrir fase regular" description="Se eliminará la clasificación congelada y el cuadro (aún no hay partidos de eliminatoria). Quedará registrado." reason="required" confirmLabel="Reabrir" size="md" />
            )}
          </>
        }
      />
      {tabs}
      {view.league.championTeam && (
        <div className="mb-5 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-200 p-5 text-amber-950 shadow">
          <Trophy className="h-10 w-10" />
          <div>
            <p className="text-xs font-bold tracking-widest uppercase">Campeón · {league.name}</p>
            <p className="font-display text-2xl">{view.league.championTeam.name}</p>
          </div>
        </div>
      )}
      {view.snapshot?.notes && <Alert tone="info" className="mb-4" title="Observaciones del cierre"><p className="whitespace-pre-wrap">{view.snapshot.notes}</p></Alert>}
      <div className="scroll-thin flex gap-4 overflow-x-auto pb-2">
        {view.stages.map((stage) => {
          const ready = stage.ties.every((t) => t.homeTeamId && t.awayTeamId);
          const generated = stage.ties.some((t) => t.matchId);
          return (
            <Card key={stage.id} className="w-80 shrink-0">
              <CardHeader title={stage.name} description={<Badge className={stage.status === "COMPLETADA" ? "bg-emerald-100 text-emerald-900 ring-emerald-300" : stage.status === "GENERADA" ? "bg-sky-100 text-sky-900 ring-sky-300" : undefined}>{STAGE_STATUS[stage.status]}</Badge>} />
              <div className="space-y-3 px-4 py-4">
                {stage.ties.map((t) => {
                  const m = t.match;
                  const side = (teamId: string | null, team: { name: string } | null, src: string) => (
                    <div className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${t.winnerTeamId && t.winnerTeamId === teamId ? "bg-emerald-100 font-extrabold" : "bg-zinc-50"}`}>
                      <span className="truncate">
                        {teamId && view.seedOf.get(teamId) && <span className="mr-1 text-xs text-zinc-500">({view.seedOf.get(teamId)})</span>}
                        {team?.name ?? <span className="text-zinc-400 italic">{describeSource(src, view.stageNames)}</span>}
                      </span>
                    </div>
                  );
                  return (
                    <div key={t.id} className="rounded-lg ring-1 ring-zinc-200">
                      <div className="space-y-1 p-2">
                        {side(t.homeTeamId, t.homeTeam, t.homeSource)}
                        {side(t.awayTeamId, t.awayTeam, t.awaySource)}
                      </div>
                      {m && (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-2 py-1.5 text-xs">
                          <span className="text-zinc-600">{formatShort(m.date)} · {m.timeSlot?.startTime ?? "—"} · {m.field?.name ?? "—"}</span>
                          {m.result ? <ScoreText result={m.result} homeTeamId={m.homeTeamId} /> : <Link href={`/resultados/${m.id}`} className="font-semibold text-brand-700 hover:underline">Registrar resultado</Link>}
                          <Link href={`/partidos/${m.id}`} className="text-zinc-500 hover:underline">editar</Link>
                        </div>
                      )}
                    </div>
                  );
                })}
                {!generated && (ready ? (
                  <GenerateStageForm action={generateStageAction} stageId={stage.id} defaultDate={suggestions[stage.id]} label={`Generar ${stage.name.toLowerCase()}`} />
                ) : (
                  <p className="text-xs text-zinc-500">Se podrá generar cuando se conozcan todos los participantes.</p>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
