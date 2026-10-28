import Link from "next/link";
import { CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardList, FileDown } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { MATCH_INCLUDE, sortMatches } from "@/server/services/matches";
import { getScoringRules } from "@/server/services/rules";
import { saveResultAction } from "@/server/actions/results";
import { ResultForm } from "@/components/forms/ResultForm";
import { Alert, buttonClass, Card, EmptyState, LinkButton, PageHeader, withParams } from "@/components/ui/core";
import { FilterSelect } from "@/components/ui/filters";
import { MatchMeta } from "@/components/matches/MatchList";
import { MatchScoreboard } from "@/components/matches/MatchScoreboard";
import { captureState, resultRuleScope, validMatchDate } from "@/domain/match-presentation";
import { formatLong, formatShort, fromISODate, todayISO, toISODate } from "@/lib/dates";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Resultados" };
const views = [
  { id: "todos", label: "Todos" },
  { id: "pendientes", label: "Por capturar" },
  { id: "registrados", label: "Registrados" },
  { id: "programar", label: "Por programar" },
] as const;

export default async function ResultadosPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Sin temporada" />;
  const sp = await searchParams;
  const today = todayISO();
  const league = ctx.leagues.find((l) => l.id === str(sp.liga));
  const view = views.find((v) => v.id === str(sp.captura))?.id ?? "todos";
  const byDate = await prisma.match.groupBy({
    by: ["date", "status"],
    where: { seasonId: ctx.id, date: { not: null }, status: { not: "CANCELADO" } },
    _count: true,
  });
  const dates = new Map<string, { total: number; pending: number }>();
  for (const g of byDate) {
    const d = toISODate(g.date)!;
    const cur = dates.get(d) ?? { total: 0, pending: 0 };
    cur.total += g._count;
    if (g.status !== "JUGADO" && g.status !== "PENDIENTE") cur.pending += g._count;
    dates.set(d, cur);
  }
  const sorted = [...dates.keys()].sort();
  const firstPending = sorted.find((d) => d <= today && (dates.get(d)?.pending ?? 0) > 0);
  const lastPast = [...sorted].reverse().find((d) => d <= today);
  const selected = validMatchDate(str(sp.date)) ?? firstPending ?? lastPast ?? sorted[0];
  const matches = selected ? sortMatches(await prisma.match.findMany({
    where: {
      seasonId: ctx.id, date: fromISODate(selected), status: { not: "CANCELADO" },
      ...(league ? { OR: [{ leagueId: league.id }, { homeTeam: { leagueId: league.id } }, { awayTeam: { leagueId: league.id } }] } : {}),
    },
    include: MATCH_INCLUDE,
  })) : [];
  const groups = [
    { id: "pendientes", title: "Por capturar", description: "Escribe el marcador del tiempo regular. Si hay empate, registra el desempate debajo." },
    { id: "registrados", title: "Resultados registrados", description: "Consulta el marcador guardado. Abre el detalle para agregar goleadores o registrar una corrección." },
    { id: "programar", title: "Falta completar la programación", description: "Programa estos partidos antes de capturar su resultado." },
  ].map((group) => ({ ...group, matches: matches.filter((m) => captureState(m) === group.id) }));
  const visibleGroups = groups.filter((group) => view === "todos" || group.id === view);
  const visibleMatches = visibleGroups.flatMap((group) => group.matches);
  const scopes = [...new Set(visibleMatches.filter((m) => captureState(m) === "pendientes").map(resultRuleScope))];
  const rulesByScope = new Map(await Promise.all(scopes.map(async (scope) => [scope, await getScoringRules(ctx.id, scope)] as const)));
  const counts = Object.fromEntries(groups.map((group) => [group.id, group.matches.length]));
  const params = { date: selected, liga: league?.id, captura: view === "todos" ? undefined : view };
  const dateOptions = [...new Set([...sorted, ...(selected ? [selected] : [])])].sort();
  const idx = selected ? dateOptions.indexOf(selected) : -1;

  return <>
    <PageHeader title="Resultados" description="Captura los marcadores de la jornada y consulta los resultados que ya guardaste."
      actions={selected && <LinkButton href={withParams("/reportes", { resultados: selected })} variant="secondary"><FileDown className="h-4 w-4" aria-hidden />PDF de resultados</LinkButton>} />
    {!selected ? <Card><EmptyState title="La primera jornada empieza aquí" description="Prepara el calendario. Los partidos aparecerán en esta sección para capturar sus resultados."
      action={<LinkButton href="/calendario">Preparar calendario</LinkButton>} /></Card> : <>
      <section aria-label="Fecha de captura" className="bg-sport mb-5 overflow-hidden rounded-xl border border-blue-950 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-l-4 border-orange-400 px-5 py-5 sm:px-6">
          <div>
            <p className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wider text-blue-100 uppercase"><CalendarDays className="h-4 w-4" aria-hidden />Jornada de resultados</p>
            <h2 className="text-lg font-bold capitalize sm:text-xl">{formatLong(selected)}</h2>
            <p className="mt-1 text-sm text-blue-100">{league?.name ?? "Todas las ligas"} · {matches.length} {matches.length === 1 ? "partido" : "partidos"} · {counts.registrados} registrados</p>
          </div>
          <nav aria-label="Cambiar fecha de resultados" className="flex flex-wrap gap-2">
            {idx > 0 && <LinkButton href={withParams("/resultados", { ...params, date: dateOptions[idx - 1] })} variant="secondary" aria-label={`Fecha anterior: ${formatShort(dateOptions[idx - 1])}`}><ChevronLeft className="h-4 w-4" aria-hidden />Anterior</LinkButton>}
            {idx < dateOptions.length - 1 && <LinkButton href={withParams("/resultados", { ...params, date: dateOptions[idx + 1] })} variant="secondary" aria-label={`Fecha siguiente: ${formatShort(dateOptions[idx + 1])}`}>Siguiente<ChevronRight className="h-4 w-4" aria-hidden /></LinkButton>}
          </nav>
        </div>
        <form key={`${selected}-${league?.id}-${view}`} action="/resultados" method="get" role="search" aria-label="Buscar jornada de resultados" className="grid items-end gap-4 border-t border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <input type="hidden" name="captura" value={view} />
          <FilterSelect name="date" label="Fecha de juego" value={selected} all={false} options={dateOptions.map((d) => ({ value: d, label: `${formatShort(d)} · ${dates.get(d)?.total ?? 0} partidos` }))} />
          <FilterSelect name="liga" label="Liga" value={league?.id} all="Todas las ligas" options={ctx.leagues.map((l) => ({ value: l.id, label: l.name }))} />
          <button type="submit" className={buttonClass("primary", "md", "min-h-11")}><ClipboardList className="h-4 w-4" aria-hidden />Ver jornada</button>
        </form>
      </section>
      {selected > today && <Alert tone="info" className="mb-5">Esta fecha aún no se disputa. Captura los marcadores cuando terminen los partidos.</Alert>}
      <nav aria-label="Filtrar por captura de resultado" className="mb-5 flex flex-wrap gap-2">
        {views.map((item) => <Link key={item.id} href={withParams("/resultados", { ...params, captura: item.id === "todos" ? undefined : item.id })} aria-current={view === item.id ? "page" : undefined}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${view === item.id ? "border-[#102d50] bg-[#102d50] text-white" : "border-slate-300 bg-white text-slate-700 hover:border-blue-700"}`}>
          {item.label}<span className={`rounded px-1.5 py-0.5 text-xs tabular-nums ${view === item.id ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"}`}>{item.id === "todos" ? matches.length : counts[item.id]}</span>
        </Link>)}
      </nav>
      {visibleMatches.length === 0 ? <Card><EmptyState title={view === "pendientes" && counts.registrados > 0 ? "Los marcadores de esta selección están al día" : "No hay partidos en esta selección"}
        description={view !== "todos" ? "Consulta todos los partidos de esta fecha o elige otra liga." : "Elige otra fecha o revisa la programación del calendario."}
        action={<LinkButton variant="secondary" href={view !== "todos" ? withParams("/resultados", { date: selected, liga: league?.id }) : "/calendario"}>{view !== "todos" ? "Ver todos los partidos" : "Ir al calendario"}</LinkButton>} /></Card>
      : <div className="space-y-7">{visibleGroups.filter((group) => group.matches.length > 0).map((group) => <section key={group.id} aria-labelledby={`grupo-${group.id}`}>
        <div className="mb-3">
          <h2 id={`grupo-${group.id}`} className="text-base font-bold text-[#102d50]">{group.title} <span className="ml-1 text-sm font-medium text-slate-500">({group.matches.length})</span></h2>
          <p className="mt-1 text-sm text-slate-600">{group.description}</p>
        </div>
        <ul className="grid items-start gap-4 2xl:grid-cols-2">{group.matches.map((m) => <li key={m.id} className={`min-w-0 rounded-xl border border-slate-300 bg-white shadow-sm ${group.id === "pendientes" ? "border-t-[3px] border-t-orange-400" : ""}`}>
          <div className="border-b border-slate-200 px-4 py-3 sm:px-5"><MatchMeta match={m} /></div>
          <div className="p-4 sm:p-5">
            {group.id === "pendientes" ? <>
              <ResultForm compact action={saveResultAction} match={{ id: m.id, homeTeam: m.homeTeam, awayTeam: m.awayTeam, isPlayoff: m.stage !== "REGULAR" }} rules={rulesByScope.get(resultRuleScope(m))!} />
              <Link href={`/resultados/${m.id}`} className="mt-3 inline-block rounded text-sm font-semibold text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">Capturar con goleadores u observaciones →</Link>
            </> : <>
              <MatchScoreboard homeTeam={m.homeTeam} awayTeam={m.awayTeam} result={m.result} />
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                {group.id === "registrados" && <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800"><Check className="h-4 w-4" aria-hidden />Resultado guardado</span>}
                <LinkButton href={`/${group.id === "registrados" ? "resultados" : "partidos"}/${m.id}`} variant="secondary" size="sm">{group.id === "registrados" ? "Detalle, goleadores y corrección" : "Programar partido"}</LinkButton>
              </div>
            </>}
          </div>
        </li>)}</ul>
      </section>)}</div>}
    </>}
  </>;
}
