import Link from "next/link";
import { CalendarDays, Check, ClipboardCheck, Settings2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { firstEditableRound, getActiveDraft, suggestedDates } from "@/server/services/schedule";
import { generateDraftAction } from "@/server/actions/schedule";
import { GeneratorForm } from "@/components/forms/schedule-forms";
import { CalendarBoard } from "@/components/calendar/CalendarBoard";
import { CalendarDraft } from "@/components/calendar/CalendarDraft";
import { Alert, buttonClass, Card, CardHeader, EmptyState, inputClass, LinkButton, PageHeader } from "@/components/ui/core";
import { roundMatchesHref, roundSummary, roundTitle, upcomingRound, validCalendarMonth } from "@/domain/calendar";
import { formatLong, todayISO, toISODate, WEEKDAYS } from "@/lib/dates";
import { int, str, type SP } from "@/lib/params";

export const metadata = { title: "Calendario y jornadas" };

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Configura la temporada para empezar" description="El calendario reúne las jornadas, los partidos y sus fechas de juego." action={<LinkButton href="/configuracion/temporadas">Configurar temporada</LinkButton>} />;
  const sp = await searchParams;
  const [minRound, draft, storedRounds, leagues] = await Promise.all([
    firstEditableRound(ctx.id),
    getActiveDraft(ctx.id),
    prisma.round.findMany({
      where: { seasonId: ctx.id },
      orderBy: [{ date: "asc" }, { number: "asc" }],
      include: { matches: { select: { status: true, date: true } } },
    }),
    prisma.league.findMany({
      where: { seasonId: ctx.id, active: true },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { teams: { where: { active: true } } } } },
    }),
  ]);
  const rounds = storedRounds.map((round) => ({ ...round, date: toISODate(round.date)!, matches: round.matches.map((match) => ({ ...match, date: toISODate(match.date) })) }));
  const requestedSection = str(sp.seccion);
  const section = requestedSection === "jornadas" || requestedSection === "preparar" ? requestedSection : draft || !rounds.length ? "preparar" : "jornadas";
  const view = str(sp.vista) === "mes" ? "mes" : "agenda";
  const fromRound = minRound > ctx.regularRounds ? minRound : Math.min(ctx.regularRounds, Math.max(minRound, int(sp.desde, minRound)));
  const canGenerate = fromRound <= ctx.regularRounds;
  const slots = ctx.timeSlots.filter((slot) => slot.active);
  const fields = ctx.venue.fields.filter((field) => field.active);
  const eligibleLeagues = leagues.filter((league) => league._count.teams >= 2);
  const ready = eligibleLeagues.length > 0 && slots.length > 0 && fields.length > 0;
  const [dates, teams] = await Promise.all([
    section === "preparar" && !draft && canGenerate && ready ? suggestedDates(ctx.id, fromRound) : Promise.resolve([]),
    section === "preparar" && draft ? prisma.team.findMany({ where: { seasonId: ctx.id }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const today = todayISO();
  const nextRound = upcomingRound(rounds, today);
  const summaries = rounds.map(roundSummary);
  const totals = summaries.reduce((total, item) => ({ remaining: total.remaining + item.remaining, played: total.played + item.played }), { remaining: 0, played: 0 });
  const requestedMonth = str(sp.mes);
  const month = validCalendarMonth(requestedMonth) ? requestedMonth : (nextRound?.date ?? rounds.at(-1)?.date ?? today).slice(0, 7);
  const regularCount = rounds.filter((round) => round.phase === "REGULAR").length;

  return (
    <>
      <PageHeader title="Calendario" description="Organiza las jornadas y encuentra rápidamente sus partidos."
        actions={<><LinkButton href="/api/pdf/calendario" target="_blank" variant="secondary">Calendario completo (PDF)</LinkButton><LinkButton href="/configuracion/horarios-canchas" variant="ghost"><Settings2 className="h-4 w-4" aria-hidden />Canchas y horarios</LinkButton></>} />

      <section aria-label="Resumen del calendario" className="mb-5 overflow-hidden rounded-xl border border-slate-300 bg-white">
        <div className="grid lg:grid-cols-[1.3fr_1fr]">
          <div className="bg-sport flex flex-wrap items-center justify-between gap-4 px-5 py-5 text-white sm:px-6">
            <div className="min-w-0">
              <p className="mb-2 text-xs font-semibold text-blue-100">{nextRound ? "Próxima jornada por disputar" : rounds.length ? "Calendario de la temporada" : "Prepara la temporada"}</p>
              <h2 className="text-xl font-bold">{nextRound ? roundTitle(nextRound) : ctx.name}</h2>
              <p className="mt-1 text-sm leading-relaxed text-blue-100">{nextRound ? formatLong(nextRound.date) : rounds.length ? totals.remaining ? "Revisa en la agenda los partidos que siguen pendientes." : "Consulta las jornadas y sus resultados." : "Elige las ligas, revisa las fechas y confirma tu propuesta."}</p>
            </div>
            {nextRound && <LinkButton href={roundMatchesHref(nextRound)} variant="secondary">{nextRound.phase === "REGULAR" ? "Ver partidos" : "Ver eliminatorias"}</LinkButton>}
          </div>
          <dl className="grid grid-cols-3 divide-x divide-slate-200 py-5">
            <div className="px-3 sm:px-5"><dt className="text-xs font-medium text-slate-600">Jornadas creadas</dt><dd className="mt-2 text-2xl font-bold text-[#102d50] tabular-nums">{regularCount}<span className="ml-1 text-sm font-medium text-slate-500">/ {ctx.regularRounds}</span><span className="mt-1 block text-[11px] font-normal text-slate-500">Fase regular</span></dd></div>
            <div className="px-3 sm:px-5"><dt className="text-xs font-medium text-slate-600">Por disputar</dt><dd className="mt-2 text-2xl font-bold text-[#102d50] tabular-nums">{totals.remaining}<span className="mt-1 block text-[11px] font-normal text-slate-500">Partidos</span></dd></div>
            <div className="px-3 sm:px-5"><dt className="text-xs font-medium text-slate-600">Disputados</dt><dd className="mt-2 text-2xl font-bold text-[#102d50] tabular-nums">{totals.played}<span className="mt-1 block text-[11px] font-normal text-slate-500">Partidos</span></dd></div>
          </dl>
        </div>
        <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs leading-relaxed text-slate-600">Día habitual: <strong>{WEEKDAYS[ctx.weekday]}</strong>. {fields.length} canchas y {slots.length} horarios activos. El resumen cuenta los partidos de estas jornadas.</p>
      </section>

      <nav aria-label="Secciones del calendario" className="mb-5 flex flex-wrap gap-2">
        {([{ value: "jornadas", label: "Consultar jornadas", icon: CalendarDays }, { value: "preparar", label: draft ? "Revisar propuesta" : "Preparar calendario", icon: ClipboardCheck }] as const).map(({ value, label, icon: Icon }) => (
          <Link key={value} href={`/calendario?seccion=${value}&vista=${view}&mes=${month}`} aria-current={section === value ? "page" : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${section === value ? "border-[#102d50] bg-[#102d50] text-white" : "border-slate-300 bg-white text-slate-700 hover:border-blue-700"}`}>
            <Icon className="h-4 w-4" aria-hidden />{label}{value === "preparar" && draft && <span className="rounded-full bg-orange-200 px-2 py-0.5 text-[11px] font-bold text-orange-950">Pendiente</span>}
          </Link>
        ))}
      </nav>

      {section === "jornadas" ? (
        <CalendarBoard rounds={rounds} view={view} month={month} today={today} hasDraft={!!draft} />
      ) : draft ? (
        <CalendarDraft key={draft.id} draft={draft} teams={teams} slots={ctx.timeSlots} fields={ctx.venue.fields} leagues={ctx.leagues} />
      ) : (
        <Card>
          <CardHeader title="Prepara la programación" description="Selecciona las ligas y las fechas. Después podrás revisar y confirmar los partidos propuestos." />
          <div className="p-4 sm:p-5">
            {!canGenerate ? (
              <EmptyState title="No quedan jornadas disponibles para generar" description="Las jornadas confirmadas o con resultados se conservan. Puedes consultar su programación y administrar los cambios desde la agenda." action={<LinkButton href="/calendario?seccion=jornadas">Ver jornadas</LinkButton>} />
            ) : !ready ? (
              <div>
                <h3 className="text-base font-bold text-[#102d50]">Completa la preparación de la temporada</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Para distribuir los partidos hacen falta equipos, canchas y horarios. Continúa con los elementos pendientes.</p>
                <ul className="mt-5 divide-y divide-slate-200 rounded-xl border border-slate-300">
                  {[
                    { ready: eligibleLeagues.length > 0, title: "Ligas con equipos", detail: `${eligibleLeagues.length} ligas con al menos dos equipos activos`, href: leagues.length ? "/equipos" : "/ligas", label: leagues.length ? "Registrar equipos" : "Crear ligas" },
                    { ready: fields.length > 0, title: "Canchas disponibles", detail: `${fields.length} canchas activas`, href: "/configuracion/horarios-canchas", label: "Configurar canchas" },
                    { ready: slots.length > 0, title: "Horarios de juego", detail: `${slots.length} horarios activos`, href: "/configuracion/horarios-canchas", label: "Configurar horarios" },
                  ].map((item) => <li key={item.title} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="flex items-center gap-2 text-sm font-semibold text-slate-900">{item.ready && <Check className="h-4 w-4 text-emerald-700" aria-hidden />}{item.title}<span className="sr-only">{item.ready ? ": listo" : ": pendiente"}</span></p><p className="mt-1 text-xs text-slate-600">{item.detail}</p></div>{!item.ready && <LinkButton href={item.href} variant="secondary" size="sm">{item.label}</LinkButton>}</li>)}
                </ul>
              </div>
            ) : (
              <>
                {minRound > 1 && <Alert tone="info" className="mb-5">Las jornadas anteriores a la {minRound} se conservan. La propuesta se prepara a partir de la jornada seleccionada.</Alert>}
                {minRound < ctx.regularRounds && <form method="get" action="/calendario" className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-slate-300 bg-slate-50 p-4">
                  <input type="hidden" name="seccion" value="preparar" />
                  <label className="text-xs font-semibold text-slate-700" htmlFor="desde">Empezar en la jornada<select id="desde" name="desde" defaultValue={fromRound} key={fromRound} className={`${inputClass} mt-1`}>
                    {Array.from({ length: ctx.regularRounds - minRound + 1 }, (_, i) => minRound + i).map((number) => <option key={number} value={number}>Jornada {number}</option>)}
                  </select></label>
                  <button type="submit" className={buttonClass("secondary")}>Actualizar fechas</button>
                </form>}
                <GeneratorForm key={`${ctx.id}-${fromRound}-${dates.join()}`} action={generateDraftAction} fromRound={fromRound} dates={dates} leagues={leagues.map((league) => ({ id: league.id, name: league.name, teams: league._count.teams }))} capacity={fields.length * slots.length} />
              </>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
