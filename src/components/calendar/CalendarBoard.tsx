import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, List, LockKeyhole, LockKeyholeOpen } from "lucide-react";
import { calendarWeeks, roundMatchesHref, roundSummary, roundTitle, shiftCalendarMonth, type CalendarRound } from "@/domain/calendar";
import { formatLong, fromISODate } from "@/lib/dates";
import { setRoundLockAction, updateRoundDateAction } from "@/server/actions/schedule";
import { RoundAdminButtons } from "@/components/forms/schedule-forms";
import { Badge, buttonClass, Card, EmptyState, inputClass, LinkButton } from "@/components/ui/core";

const monthLabel = (month: string) => new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(fromISODate(`${month}-01`));

export function CalendarBoard({ rounds, view, month, today, hasDraft }: {
  rounds: CalendarRound[]; view: "agenda" | "mes"; month: string; today: string; hasDraft: boolean;
}) {
  const href = (targetView: string, targetMonth = month) => `/calendario?seccion=jornadas&vista=${targetView}&mes=${targetMonth}#jornadas`;
  return (
    <Card id="jornadas" className="min-w-0 scroll-mt-20">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5">
        <div><h2 className="text-base font-bold text-[#102d50]">Jornadas de la temporada</h2><p className="mt-1 text-xs text-slate-600">Consulta las fechas y abre los partidos de cada jornada.</p></div>
        <nav aria-label="Vista del calendario" className="flex gap-1 rounded-lg border border-slate-300 bg-slate-100 p-1">
          {([{ value: "agenda", label: "Agenda", icon: List }, { value: "mes", label: "Mes", icon: CalendarDays }] as const).map(({ value, label, icon: Icon }) => (
            <Link key={value} href={href(value)} aria-current={view === value ? "page" : undefined} className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-blue-700 ${view === value ? "bg-[#102d50] text-white" : "text-slate-700 hover:bg-white"}`}><Icon className="h-4 w-4" aria-hidden />{label}</Link>
          ))}
        </nav>
      </div>
      {rounds.length === 0 ? (
        <EmptyState title="Tu calendario empieza aquí" description={hasDraft ? "Hay una propuesta pendiente de revisión. Las jornadas aparecerán aquí cuando la confirmes." : "Selecciona las ligas y las fechas para preparar la programación de la temporada."}
          action={<LinkButton href="/calendario?seccion=preparar">{hasDraft ? "Revisar propuesta" : "Preparar calendario"}</LinkButton>} />
      ) : view === "mes" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
            <div className="flex items-center gap-2">
              <Link href={href("mes", shiftCalendarMonth(month, -1))} aria-label="Mes anterior" className={buttonClass("secondary", "sm")}><ChevronLeft className="h-4 w-4" aria-hidden /></Link>
              <h3 className="min-w-36 text-center text-sm font-bold text-slate-900 capitalize">{monthLabel(month)}</h3>
              <Link href={href("mes", shiftCalendarMonth(month, 1))} aria-label="Mes siguiente" className={buttonClass("secondary", "sm")}><ChevronRight className="h-4 w-4" aria-hidden /></Link>
            </div>
            <form method="get" action="/calendario#jornadas" className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="seccion" value="jornadas" /><input type="hidden" name="vista" value="mes" />
              <label className="min-w-0 text-xs font-semibold text-slate-700">Ir al mes<input type="month" name="mes" required defaultValue={month} key={month} className={`${inputClass} mt-1`} /></label>
              <button type="submit" className={buttonClass("secondary")}>Ver</button>
            </form>
          </div>
          <div className="scroll-thin overflow-x-auto focus-visible:outline-2 focus-visible:outline-blue-700" role="region" aria-label="Calendario mensual de jornadas" tabIndex={0}>
            <table className="w-full min-w-[600px] table-fixed border-collapse text-left">
              <caption className="sr-only">Jornadas de {monthLabel(month)}. Cada enlace abre la jornada en la agenda.</caption>
              <thead><tr>{["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((day) => <th key={day} scope="col" className="border-b border-slate-200 bg-slate-50 py-3 text-center text-xs font-semibold text-slate-600">{day}</th>)}</tr></thead>
              <tbody>{calendarWeeks(month).map((week, index) => <tr key={index}>{week.map((date, column) => {
                const daily = rounds.filter((round) => round.date === date);
                return <td key={column} className={`h-28 border border-slate-200 p-2 align-top ${date ? "bg-white" : "bg-slate-50"}`}>
                  {date && <>
                    <time dateTime={date} aria-current={date === today ? "date" : undefined} className={`mb-2 inline-grid h-7 w-7 place-items-center rounded-full text-xs font-semibold tabular-nums ${date === today ? "bg-orange-200 text-orange-950" : "text-slate-600"}`}>{Number(date.slice(-2))}<span className="sr-only">{date === today ? ", hoy" : ""}</span></time>
                    <div className="space-y-1.5">{daily.map((round) => <Link key={round.id} href={`${href("agenda").split("#")[0]}#jornada-${round.id}`} className="block break-words rounded-md border border-blue-200 bg-blue-50 px-2 py-2 text-xs font-semibold text-blue-900 hover:border-blue-700 focus-visible:outline-2 focus-visible:outline-blue-700">
                      {roundTitle(round)}<span className="mt-1 block text-[11px] font-normal">{roundSummary(round).active} partidos</span>
                    </Link>)}</div>
                  </>}
                </td>;
              })}</tr>)}</tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-xs leading-relaxed text-slate-600">Se muestra la fecha de cada jornada. Consulta los partidos para ver sus horarios y cualquier cambio individual. En pantallas pequeñas puedes deslizar el mes o usar Agenda.</p>
          {!rounds.some((round) => round.date.startsWith(month)) && <p className="border-t border-slate-200 px-5 py-4 text-sm text-slate-600">No hay jornadas en este mes. <Link href={href("agenda")} className="font-semibold text-blue-800 underline">Ver todas en la agenda</Link></p>}
        </>
      ) : (
        <ol className="divide-y divide-slate-200">
          {rounds.map((round) => {
            const summary = roundSummary(round);
            const date = fromISODate(round.date);
            const Lock = round.locked ? LockKeyhole : LockKeyholeOpen;
            return <li key={round.id} id={`jornada-${round.id}`} className="scroll-mt-20 px-4 py-5 sm:px-5">
              <div className="flex items-start gap-3 sm:gap-5">
                <time dateTime={round.date} className={`flex w-14 shrink-0 flex-col items-center rounded-lg border py-2 sm:w-16 ${round.date === today ? "border-orange-300 bg-orange-50 text-orange-950" : "border-blue-200 bg-blue-50 text-[#102d50]"}`}>
                  <span className="text-[11px] font-semibold">{new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" }).format(date)}</span><span className="text-2xl font-bold leading-tight tabular-nums">{date.getUTCDate()}</span>
                  {round.date === today && <span className="text-[10px] font-bold">Hoy</span>}
                </time>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900"><Link href={roundMatchesHref(round)} className="rounded hover:text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-blue-700">{roundTitle(round)}</Link></h3>
                    <Badge className={round.locked ? "bg-blue-50 text-blue-900 ring-blue-200" : undefined}><Lock className="mr-1 h-3 w-3" aria-hidden />{round.locked ? "Protegida" : "Editable"}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{formatLong(round.date)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700">
                    <span><strong className="tabular-nums">{summary.played}/{summary.active}</strong> partidos disputados</span>
                    {summary.cancelled > 0 && <span className="text-xs">{summary.cancelled} cancelados</span>}
                    {summary.unassigned > 0 && <span className="text-xs font-semibold text-amber-800">{summary.unassigned} sin horario o cancha</span>}
                  </div>
                  {summary.active > 0 && <progress max={summary.active} value={summary.played} aria-label={`Avance de ${roundTitle(round)}`} className="mt-2 block h-1.5 w-full max-w-64 overflow-hidden rounded-full accent-blue-800 [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:bg-blue-800 [&::-moz-progress-bar]:bg-blue-800" />}
                  {summary.moved > 0 && <p className="mt-2 text-xs text-amber-800">{summary.moved} {summary.moved === 1 ? "partido tiene otra fecha" : "partidos tienen otras fechas"}. Abre la jornada para consultarlos.</p>}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <LinkButton href={roundMatchesHref(round)} size="sm" variant="secondary">{round.phase === "REGULAR" ? "Ver partidos" : "Ver eliminatorias"}</LinkButton>
                    <LinkButton href={`/api/pdf/rol?date=${round.date}`} target="_blank" size="sm" variant="ghost">Rol del día (PDF)</LinkButton>
                    {round.phase === "REGULAR" && <details className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:ml-auto sm:w-auto">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-700">Administrar jornada</summary>
                      <div className="mt-3"><RoundAdminButtons roundId={round.id} number={round.number} date={round.date} locked={round.locked} lockAction={setRoundLockAction} dateAction={updateRoundDateAction} /></div>
                    </details>}
                  </div>
                </div>
              </div>
            </li>;
          })}
        </ol>
      )}
    </Card>
  );
}
