import Link from "next/link";
import { BookOpen, FileDown, Goal, PencilLine } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { getLeagueScorers } from "@/server/services/standings";
import { getTiebreakers } from "@/server/services/rules";
import { SCORER_CRITERIA } from "@/domain/scorers";
import { resolveScorersPeriod, scorersPdfHref } from "@/domain/scorers-view";
import { Card, Collapsible, EmptyState, LinkButton, PageHeader, withParams, buttonClass } from "@/components/ui/core";
import { FilterSelect, LeagueTabs } from "@/components/ui/filters";
import { ScorersTable } from "@/components/scorers/ScorersTable";
import { formatLong, formatShort } from "@/lib/dates";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Goleadores" };

export default async function GoleoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx || ctx.leagues.length === 0) return <EmptyState title="Prepara las ligas para consultar el goleo" description="Aquí aparecerán los jugadores y sus goles registrados durante la temporada."
    action={<LinkButton href={ctx ? "/ligas" : "/configuracion/temporadas"}>{ctx ? "Registrar ligas" : "Configurar temporada"}</LinkButton>} />;
  const sp = await searchParams;
  const league = ctx.leagues.find((l) => l.id === str(sp.liga)) ?? ctx.leagues[0];
  const [rounds, tiebreakers] = await Promise.all([
    prisma.round.findMany({ where: { seasonId: ctx.id, phase: "REGULAR" }, orderBy: { number: "asc" }, select: { number: true, date: true } }),
    getTiebreakers(ctx.id, league.id),
  ]);
  const selection = resolveScorersPeriod({ periodo: str(sp.periodo), jornada: str(sp.jornada), eliminatorias: str(sp.eliminatorias) }, rounds.map((r) => r.number));
  const { period, round, includePlayoffs } = selection;
  const scorers = await getLeagueScorers(league.id, { includePlayoffs, upToRound: round });
  const periodLabel = includePlayoffs ? "Fase regular + eliminatorias" : round !== undefined ? `Fase regular · hasta la jornada ${round}` : "Fase regular · todas las jornadas";
  const totalGoals = scorers.rows.reduce((total, row) => total + row.goals, 0);
  const hasSharedPlaces = scorers.rows.some((row) => row.shared);
  const resultsHref = withParams("/resultados", { liga: league.id });

  return <>
    <PageHeader title="Goleadores" description="Consulta quiénes han anotado más goles y el aporte de cada jugador a sus equipos."
      actions={<LinkButton href={scorersPdfHref(league.id, selection)} target="_blank" variant="secondary"><FileDown className="h-4 w-4" aria-hidden />PDF de esta tabla</LinkButton>} />
    <LeagueTabs path="/goleo" leagues={ctx.leagues} selected={league.id} params={{ periodo: period }} />
    <section aria-label="Liga y período de goleo" className="mb-5 overflow-hidden rounded-xl border border-slate-300 bg-white">
      <div className="bg-sport flex flex-wrap items-center justify-between gap-4 border-l-4 border-orange-400 px-5 py-5 text-white sm:px-6">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium text-blue-100">{ctx.name}</p>
          <h2 className="text-xl font-bold break-words">{league.name}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100">{scorers.rows.length && scorers.lastResultDate ? `Goles individuales registrados hasta el ${formatLong(scorers.lastResultDate)}.` : "El goleo se actualiza al registrar quién anotó en cada partido."}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold"><Goal className="h-4 w-4 shrink-0" aria-hidden />{periodLabel}</span>
      </div>
      <form key={`${league.id}-${period}`} action="/goleo" method="get" aria-label="Consultar goleadores por período" className="flex flex-wrap items-end gap-3 bg-slate-50 px-4 py-4 sm:px-5">
        <input type="hidden" name="liga" value={league.id} />
        <div className="w-full sm:max-w-md"><FilterSelect name="periodo" label="Período de consulta" value={period} all={false} options={[
          { value: "regular", label: "Fase regular · todas las jornadas" },
          { value: "completa", label: "Fase regular + eliminatorias" },
          ...rounds.map((r) => ({ value: `jornada-${r.number}`, label: `Hasta la jornada ${r.number} · ${formatShort(r.date)}` })),
        ]} /></div>
        <button type="submit" className={buttonClass("primary", "md", "min-h-11")}>Aplicar</button>
        {period !== "regular" && <LinkButton href={withParams("/goleo", { liga: league.id })} variant="secondary" className="min-h-11">Restablecer</LinkButton>}
        <p className="w-full text-xs leading-relaxed text-slate-600">Las consultas hasta una jornada incluyen solo la fase regular. Para sumar las eliminatorias, elige el período completo.</p>
      </form>
    </section>

    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-base font-bold text-[#102d50]">Clasificación de goleadores</h2>
          <p className="mt-1 text-xs text-slate-600">{scorers.rows.length} {scorers.rows.length === 1 ? "jugador" : "jugadores"} · {totalGoals} {totalGoals === 1 ? "gol individual registrado" : "goles individuales registrados"}</p>
        </div>
        {scorers.rows.length > 0 && <LinkButton href={resultsHref} variant="secondary" size="sm"><PencilLine className="h-3.5 w-3.5" aria-hidden />Registrar goleadores</LinkButton>}
      </div>
      {scorers.rows.length === 0 ? <EmptyState title={round !== undefined ? `Sin goleadores registrados hasta la jornada ${round}` : "Aún no hay goleadores registrados"}
        description="Guardar el marcador no asigna los goles a los jugadores. Abre un resultado y registra quién anotó para que aparezca en esta clasificación."
        action={<LinkButton href={resultsHref}>Ir a Resultados</LinkButton>} />
      : <ScorersTable rows={scorers.rows} caption={`${league.name}: ${periodLabel}`} />}
      {hasSharedPlaces && <p className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950 sm:px-5"><strong>Posiciones compartidas:</strong> los criterios de la liga no separan a esos jugadores. Comparten lugar; el orden alfabético entre ellos no cambia su posición.</p>}
    </Card>

    <Collapsible title={<span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4 text-blue-800" aria-hidden />Cómo se calcula el goleo</span>} className="mt-5">
      <div className="space-y-5 p-4 sm:p-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="text-sm font-bold text-[#102d50]">Goles</dt><dd className="mt-1 text-sm leading-relaxed text-slate-600">Suma de los goles individuales registrados a nombre del jugador en el período elegido. Los amistosos y los penales de desempate se excluyen.</dd></div>
          <div><dt className="text-sm font-bold text-[#102d50]">Partidos con gol</dt><dd className="mt-1 text-sm leading-relaxed text-slate-600">Encuentros en los que el jugador anotó al menos una vez. No representa el total de partidos que jugó.</dd></div>
          <div><dt className="text-sm font-bold text-[#102d50]">Más de un equipo</dt><dd className="mt-1 text-sm leading-relaxed text-slate-600">Se conservan los goles registrados con cada equipo de esta liga. El desglose aparece junto a sus nombres.</dd></div>
          <div><dt className="text-sm font-bold text-[#102d50]">Posición compartida</dt><dd className="mt-1 text-sm leading-relaxed text-slate-600">Si el empate no se resuelve, los jugadores conservan el mismo lugar. Por ejemplo: 1, 1, 3.</dd></div>
        </dl>
        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-bold text-[#102d50]">Orden de clasificación</h3>
          <p className="mt-2 text-sm text-slate-600">Primero se compara el total de goles, de mayor a menor.</p>
          {tiebreakers.scorerCriteria.length ? <><p className="mt-2 text-sm text-slate-600">En caso de empate se aplican, en este orden:</p><ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm text-slate-600">{tiebreakers.scorerCriteria.map((criterion) => <li key={criterion}>{SCORER_CRITERIA[criterion]}</li>)}</ol></>
          : <p className="mt-2 text-sm text-slate-600">Esta liga no tiene criterios adicionales: quienes tengan los mismos goles comparten posición.</p>}
          <Link href={withParams("/configuracion/reglas", { liga: league.id })} className="mt-3 inline-block rounded text-sm font-semibold text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">Consultar configuración</Link>
        </div>
      </div>
    </Collapsible>
  </>;
}
