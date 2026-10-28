import Link from "next/link";
import { BookOpen, FileDown, ListOrdered, LockKeyhole } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { getLeagueStandings } from "@/server/services/standings";
import { getScoringRules, getTiebreakers } from "@/server/services/rules";
import { Alert, Card, Collapsible, EmptyState, LinkButton, PageHeader, withParams, buttonClass } from "@/components/ui/core";
import { FilterSelect, LeagueTabs } from "@/components/ui/filters";
import { StandingsTable } from "@/components/standings/StandingsTable";
import { resolveStandingsView } from "@/domain/standings-view";
import { TIEBREAK_CRITERIA } from "@/domain/standings";
import { formatDateTime, formatLong, formatShort } from "@/lib/dates";
import { STANDING_ABBR } from "@/lib/labels";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Tabla general" };

export default async function TablaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx || ctx.leagues.length === 0) return <EmptyState title="Prepara las ligas de la temporada" description="La tabla reunirá a los equipos y sus puntos conforme se registren los resultados oficiales." action={<LinkButton href={ctx ? "/ligas" : "/configuracion/temporadas"}>{ctx ? "Registrar ligas" : "Configurar temporada"}</LinkButton>} />;
  const sp = await searchParams;
  const league = ctx.leagues.find((l) => l.id === str(sp.liga)) ?? ctx.leagues[0];
  const [snapshot, rounds, rules, tiebreakers] = await Promise.all([
    prisma.standingSnapshot.findUnique({ where: { leagueId_kind: { leagueId: league.id, kind: "CIERRE_FASE_REGULAR" } }, select: { createdAt: true } }),
    prisma.round.findMany({ where: { seasonId: ctx.id, phase: "REGULAR" }, orderBy: { number: "asc" }, select: { id: true, number: true, date: true } }),
    getScoringRules(ctx.id, league.id),
    getTiebreakers(ctx.id, league.id),
  ]);
  const { round, view } = resolveStandingsView({ jornada: str(sp.jornada), vista: str(sp.vista) }, rounds.map((r) => r.number), !!snapshot);
  const standings = await getLeagueStandings(league.id, { upToRound: round, useSnapshot: view === "final" });
  const hasResults = standings.rows.some((row) => row.jj > 0);
  const showE = standings.rows.some((row) => row.e > 0);
  const nameById = new Map(standings.rows.map((row) => [row.teamId, row.teamName]));
  const unresolved = hasResults ? standings.unresolvedGroups.filter((group) => group.length > 0) : [];
  const viewLabel = standings.frozen ? "Cierre oficial" : round ? `Hasta la jornada ${round}` : "Clasificación actual";
  const updatedLabel = standings.frozenAt
    ? `Guardada al cerrar la fase regular el ${formatDateTime(standings.frozenAt)}.`
    : standings.lastResultDate ? `Resultados oficiales hasta el ${formatLong(standings.lastResultDate)}.` : "La clasificación se actualizará al registrar los primeros resultados oficiales.";

  return <>
    <PageHeader title="Tabla general" description="Compara los puntos de cada equipo y consulta las posiciones de clasificación."
      actions={<LinkButton href={withParams("/api/pdf/tabla-general", { league: league.id, round, view })} target="_blank" variant="secondary"><FileDown className="h-4 w-4" aria-hidden />PDF de esta tabla</LinkButton>} />
    <LeagueTabs path="/tabla" leagues={ctx.leagues} selected={league.id} params={{ jornada: round, vista: view }} />

    <section aria-label="Liga y clasificación seleccionadas" className="mb-5 overflow-hidden rounded-xl border border-slate-300 bg-white">
      <div className="bg-sport flex flex-wrap items-center justify-between gap-4 border-l-4 border-orange-400 px-5 py-5 text-white sm:px-6">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium text-blue-100">{ctx.name} · Fase regular</p>
          <h2 className="text-xl font-bold break-words">{league.name}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100">{updatedLabel}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold">
          {standings.frozen ? <LockKeyhole className="h-4 w-4" aria-hidden /> : <ListOrdered className="h-4 w-4" aria-hidden />}{viewLabel}
        </span>
      </div>
      {snapshot && <nav aria-label="Origen de la clasificación" className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
        {([{ id: "actual", label: "Resultados actuales" }, { id: "final", label: "Cierre oficial" }] as const).map((option) => <Link key={option.id} href={withParams("/tabla", { liga: league.id, vista: option.id })} aria-current={view === option.id ? "page" : undefined}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${view === option.id ? "border-[#102d50] bg-[#102d50] text-white" : "border-slate-300 bg-white text-slate-700 hover:border-blue-700"}`}>{option.label}</Link>)}
      </nav>}
      {standings.frozen ? <p className="px-5 py-4 text-sm leading-relaxed text-slate-600">Esta es la clasificación guardada al cerrar la fase regular y utilizada para las eliminatorias. Para consultar una jornada, cambia a <strong className="text-slate-800">Resultados actuales</strong>.</p>
      : <form key={`${league.id}-${round ?? "todas"}`} action="/tabla" method="get" aria-label="Consultar clasificación por jornada" className="flex flex-wrap items-end gap-3 bg-slate-50 px-4 py-4 sm:px-5">
        <input type="hidden" name="liga" value={league.id} /><input type="hidden" name="vista" value="actual" />
        <div className="w-full sm:w-72"><FilterSelect name="jornada" label="Hasta la jornada" value={round === undefined ? undefined : String(round)} all="Todas las jornadas" options={rounds.map((r) => ({ value: String(r.number), label: `Jornada ${r.number} · ${formatShort(r.date)}` }))} /></div>
        <button type="submit" className={buttonClass("primary", "md", "min-h-11")}>Aplicar</button>
        {round !== undefined && <LinkButton href={withParams("/tabla", { liga: league.id, vista: "actual" })} variant="secondary" className="min-h-11">Ver todas</LinkButton>}
        <p className="w-full text-xs leading-relaxed text-slate-600">{snapshot ? "Cálculo con los resultados registrados; el cierre oficial se conserva por separado." : "Solo cuentan los resultados oficiales de la fase regular. Los amistosos y las eliminatorias se excluyen."}</p>
      </form>}
    </section>

    {unresolved.length > 0 && <Alert tone="warn" className="mb-5" title="Hay posiciones pendientes de desempate">
      <p>Estos equipos siguen empatados después de aplicar los criterios de la liga. Dentro de cada grupo aparecen en orden alfabético:</p>
      <ul className="mt-2 list-inside list-disc space-y-1">{unresolved.map((group) => <li key={group.join("-")}>{group.map((id) => nameById.get(id)).join(", ")}</li>)}</ul>
      <p className="mt-2">Si el empate afecta la clasificación, se pedirá la decisión oficial al cerrar la fase regular.</p>
    </Alert>}
    {!standings.frozen && !hasResults && standings.rows.length > 0 && <Alert tone="info" className="mb-5" title="Aún no hay resultados oficiales en esta selección">
      Los equipos se muestran con sus estadísticas en cero. El orden y las zonas son provisionales hasta que haya resultados.
      <Link href={withParams("/resultados", { liga: league.id })} className="ml-1 rounded font-semibold underline focus-visible:outline-2 focus-visible:outline-blue-700">Ir a capturar resultados</Link>
    </Alert>}

    <Card className="overflow-hidden">
      {standings.rows.length === 0 ? <EmptyState title="Esta liga todavía no tiene equipos en la tabla" description="Registra los equipos participantes para preparar la clasificación. Sus estadísticas aparecerán aquí conforme avance la temporada."
        action={<LinkButton href={withParams("/equipos", { liga: league.id })}>Registrar equipos</LinkButton>} />
      : <StandingsTable rows={standings.rows} caption={`${league.name}: ${viewLabel}`} hasResults={hasResults} />}
      {standings.rows.length > 0 && standings.zones.length > 0 && <section aria-labelledby="zonas-tabla" className="border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
        <h3 id="zonas-tabla" className="text-sm font-bold text-[#102d50]">Zonas de clasificación</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{standings.frozen ? "Posiciones del cierre oficial según el cuadro configurado." : "Las marcas muestran la zona de cada posición según el cuadro configurado. Se confirman al cerrar la fase regular."}</p>
        <ul className="mt-3 flex flex-wrap gap-2">{standings.zones.map((zone, index) => <li key={`${zone.label}-${index}`} className="flex items-start gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">
          <span className="mt-0.5 h-3 w-3 shrink-0 rounded-sm border border-black/10" style={{ backgroundColor: zone.color }} aria-hidden />
          <span><span className="font-semibold">{zone.label}</span><span className="mt-0.5 block text-slate-500">Posiciones: {zone.positions.join(", ")}</span></span>
        </li>)}</ul>
      </section>}
    </Card>

    <Collapsible title={<span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4 text-blue-800" aria-hidden />Cómo leer la tabla</span>} className="mt-5">
      <div className="space-y-5 p-4 sm:p-5">
        <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(STANDING_ABBR).filter(([key]) => key !== "E" || showE || rules.allowDraws).map(([key, description]) => <div key={key} className="flex items-start gap-3">
          <dt className="w-9 shrink-0 text-xs font-bold text-[#102d50]">{key}</dt><dd className="text-xs leading-relaxed text-slate-600">{description}</dd>
        </div>)}</dl>
        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-bold text-[#102d50]">Puntuación de esta liga</h3>
          <ul className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <li>Victoria en tiempo regular: <strong className="text-slate-900">{rules.winPoints} puntos</strong>.</li>
            <li>Derrota en tiempo regular: <strong className="text-slate-900">{rules.lossPoints} puntos</strong>.</li>
            <li>Victoria por desempate: <strong className="text-slate-900">{rules.shootoutWinPoints} puntos</strong>.</li>
            <li>Derrota por desempate: <strong className="text-slate-900">{rules.shootoutLossPoints} puntos</strong>.</li>
            {rules.allowDraws && rules.drawPoints != null && <li>Empate definitivo: <strong className="text-slate-900">{rules.drawPoints} puntos</strong> por equipo.</li>}
          </ul>
          {standings.frozen && <p className="mt-2 text-xs text-slate-500">Las reglas y los criterios de desempate que se muestran son los configurados actualmente. El cierre oficial conserva los puntos y el orden guardados al cerrar.</p>}
        </div>
        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-bold text-[#102d50]">Criterios de desempate</h3>
          <ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm text-slate-600">{tiebreakers.criteria.map((criterion) => <li key={criterion}>{TIEBREAK_CRITERIA[criterion]}</li>)}</ol>
          <Link href={withParams("/configuracion/reglas", { liga: league.id })} className="mt-3 inline-block rounded text-sm font-semibold text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">Consultar configuración</Link>
        </div>
      </div>
    </Collapsible>
  </>;
}
