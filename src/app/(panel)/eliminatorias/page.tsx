import Link from "next/link";
import { Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { getBracketView, getClosureReview, suggestStageDate } from "@/server/services/playoffs";
import { generateStageAction, reopenRegularPhaseAction } from "@/server/actions/playoffs";
import { GenerateStageForm } from "@/components/forms/playoff-forms";
import { ConfirmAction } from "@/components/ui/form";
import { Alert, Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, Table, TD, TH } from "@/components/ui/core";
import { ScoreText } from "@/components/match-ui";
import { describeSource } from "@/domain/bracket";
import { formatShort } from "@/lib/dates";
import { STAGE_STATUS } from "@/lib/labels";
import { BracketPreview } from "@/components/playoffs/BracketPreview";
import { ClosureReview } from "@/components/playoffs/ClosureReview";
import { PlayoffProgress } from "@/components/playoffs/PlayoffProgress";
import { LeagueTabs } from "@/components/ui/filters";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Eliminatorias" };

export default async function EliminatoriasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx || ctx.leagues.length === 0) return <EmptyState title="Primero configura las ligas" description="Cada liga tiene su propia clasificación y cuadro de eliminatorias." action={<LinkButton href="/ligas">Ir a ligas</LinkButton>} />;
  const sp = await searchParams;
  const league = ctx.leagues.find((l) => l.id === str(sp.liga)) ?? ctx.leagues[0];
  const review = await getClosureReview(league.id);

  const tabs = <LeagueTabs path="/eliminatorias" leagues={ctx.leagues} selected={league.id} />;

  if (!review.closed) {
    const hasTeams = review.standings.rows.length > 0;
    return (
      <>
        <PageHeader title="Eliminatorias" description="Revisa la fase regular, confirma los cruces y sigue el camino al campeonato."
          actions={<LinkButton href={`/api/pdf/eliminatorias?league=${league.id}`} target="_blank" variant="secondary">PDF del cuadro</LinkButton>} />
        {tabs}
        <PlayoffProgress closed={false} />
        {hasTeams ? (
          <div className="mb-5 grid items-start gap-5 xl:grid-cols-[1fr_1.2fr]">
            <ClosureReview review={review} />
            <Card className="min-w-0">
              <CardHeader title="Clasificación que se guardará" description="El orden aún puede cambiar. Revisa los resultados y desempates antes del cierre."
                actions={<LinkButton href={`/tabla?liga=${league.id}`} size="sm" variant="secondary">Tabla completa</LinkButton>} />
              <Table>
                <thead><tr><TH className="text-center">Pos</TH><TH>Equipo</TH><TH className="text-center">JJ</TH><TH className="text-center">DIF</TH><TH className="text-center">PTS</TH><TH>Zona</TH></tr></thead>
                <tbody>
                  {review.standings.rows.slice(0, 16).map((row) => (
                    <tr key={row.teamId}>
                      <TD className="text-center"><span className="inline-grid h-6 w-6 place-items-center rounded text-xs font-bold" style={{ background: row.zone?.color ?? "#e4e4e7" }}>{row.position}</span></TD>
                      <TD className="font-semibold">{row.teamName}{row.unresolvedTieGroup !== null && <Badge className="ml-2 bg-amber-100 text-amber-900 ring-amber-300">empate</Badge>}</TD>
                      <TD className="text-center">{row.jj}</TD><TD className="text-center">{row.dif}</TD><TD className="text-center font-bold">{row.pts}</TD>
                      <TD className="text-xs text-slate-600">{row.zone?.label ?? "—"}</TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-600">{review.standings.rows.length > 16 ? `Mostrando los primeros 16 de ${review.standings.rows.length} equipos.` : `${review.standings.rows.length} equipos en la clasificación.`}</p>
            </Card>
          </div>
        ) : (
          <Card className="mb-5">
            <EmptyState title={`Prepara los equipos de ${league.name}`} description="Esta liga todavía no tiene equipos en la clasificación. Registra los participantes y programa las jornadas; después podrás revisar los resultados y cerrar la fase regular."
              action={<div className="flex flex-wrap justify-center gap-3"><LinkButton href={`/equipos?liga=${league.id}`}>Registrar equipos</LinkButton><LinkButton href="/calendario" variant="secondary">Ver calendario</LinkButton></div>} />
          </Card>
        )}
        <Card>
          <CardHeader title="Camino al campeonato" description={`Vista previa del cuadro de ${league.name}. Los equipos se asignarán al confirmar el cierre.`}
            actions={<LinkButton href={`/configuracion/eliminatorias?liga=${league.id}`} size="sm" variant="secondary">Configurar cruces</LinkButton>} />
          <BracketPreview format={review.bracket} />
        </Card>
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
      <PlayoffProgress closed complete={!!view.league.championTeam} />
      {view.league.championTeam && (
        <div className="mb-5 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-200 p-5 text-amber-950 shadow">
          <Trophy className="h-10 w-10 shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold tracking-widest uppercase">Campeón · {league.name}</p>
            <p className="font-display text-2xl">{view.league.championTeam.name}</p>
          </div>
        </div>
      )}
      {view.snapshot?.notes && <Alert tone="info" className="mb-4" title="Observaciones del cierre"><p className="whitespace-pre-wrap">{view.snapshot.notes}</p></Alert>}
      <p className="mb-3 text-sm text-slate-600">Sigue cada etapa de izquierda a derecha. Abre un partido para registrar el resultado o ajustar su programación.</p>
      <div role="region" aria-label="Partidos de eliminatorias por etapa" tabIndex={0} className="scroll-thin flex gap-4 overflow-x-auto rounded-xl pb-2 focus-visible:outline-2 focus-visible:outline-blue-700">
        {view.stages.map((stage) => {
          const ready = stage.ties.every((t) => t.homeTeamId && t.awayTeamId);
          const generated = stage.ties.some((t) => t.matchId);
          return (
            <Card key={stage.id} className="w-80 max-w-[calc(100vw-2.5rem)] shrink-0 border-t-4 border-t-[#102d50]">
              <CardHeader title={stage.name} description={<Badge className={stage.status === "COMPLETADA" ? "bg-emerald-100 text-emerald-900 ring-emerald-300" : stage.status === "GENERADA" ? "bg-sky-100 text-sky-900 ring-sky-300" : undefined}>{STAGE_STATUS[stage.status]}</Badge>} />
              <div className="space-y-3 px-4 py-4">
                {stage.ties.map((t) => {
                  const m = t.match;
                  const side = (teamId: string | null, team: { name: string } | null, src: string) => (
                    <div className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${t.winnerTeamId && t.winnerTeamId === teamId ? "bg-emerald-100 font-extrabold" : "bg-slate-50"}`}>
                      <span className="break-words">
                        {teamId && view.seedOf.get(teamId) && <span className="mr-1 text-xs text-zinc-500">({view.seedOf.get(teamId)})</span>}
                        {team?.name ?? <span className="text-slate-600 italic">{describeSource(src, view.stageNames)}</span>}
                      </span>
                    </div>
                  );
                  return (
                    <div key={t.id} className="rounded-lg border border-slate-300">
                      <div className="space-y-1 p-2">
                        {side(t.homeTeamId, t.homeTeam, t.homeSource)}
                        {side(t.awayTeamId, t.awayTeam, t.awaySource)}
                      </div>
                      {m && (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-2 py-1.5 text-xs">
                          <span className="text-zinc-600">{formatShort(m.date)} · {m.timeSlot?.startTime ?? "—"} · {m.field?.name ?? "—"}</span>
                          {m.result ? <ScoreText result={m.result} homeTeamId={m.homeTeamId} /> : <Link href={`/resultados/${m.id}`} className="font-semibold text-blue-800 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-blue-700">Registrar resultado</Link>}
                          <Link href={`/partidos/${m.id}`} className="text-blue-800 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-blue-700">Editar partido</Link>
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
