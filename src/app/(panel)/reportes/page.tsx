import { FileDown } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { matchDays } from "@/server/services/matchdays";
import { WhatsAppPdfs } from "@/components/WhatsAppPdfs";
import { ReportCard } from "@/components/reports/ReportCard";
import { buttonClass, EmptyState, LinkButton, PageHeader } from "@/components/ui/core";
import { REPORT_DOCUMENTS, resolveReportDates } from "@/domain/reports-view";
import { formatShort, todayISO } from "@/lib/dates";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Reportes y PDF" };

export default async function ReportesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Crea una temporada para preparar sus reportes" description="Los documentos reúnen la programación, los resultados y los participantes de una temporada." action={<LinkButton href="/configuracion/temporadas">Crear temporada</LinkButton>} />;
  const [sp, days, teams, types, perLeague] = await Promise.all([
    searchParams, matchDays(ctx.id),
    prisma.team.findMany({ where: { seasonId: ctx.id }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, active: true, leagueId: true, league: { select: { name: true } } } }),
    prisma.sanctionType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
    prisma.team.groupBy({ by: ["leagueId"], where: { seasonId: ctx.id, active: true }, _count: true }),
  ]);
  const dates = resolveReportDates({ rol: str(sp.rol), resultados: str(sp.resultados) }, days, todayISO());
  const withTeams = new Set(perLeague.map((group) => group.leagueId));
  const leagues = ctx.leagues.filter((league) => league.active && withTeams.has(league.id)).map(({ id, name }) => ({ id, name }));
  const leagueOptions = ctx.leagues.map((league) => ({ value: league.id, label: `${league.name}${league.active ? "" : " (inactiva)"}` }));
  const teamOptions = teams.map((team) => ({ value: team.id, label: `${team.name} (${team.league.name})${team.active ? "" : " · Baja"}`, leagueId: team.leagueId }));
  const typeOptions = types.map((type) => ({ value: type.id, label: `${type.name}${type.active ? "" : " (inactivo)"}` }));

  return <>
    <PageHeader title="Reportes y PDF" description="Elige un documento, revisa sus opciones y ábrelo o descárgalo para compartirlo." />
    <section aria-label="Temporada de los reportes" className="bg-sport mb-5 flex items-start gap-4 rounded-xl border-l-4 border-orange-400 px-5 py-5 text-white sm:px-6">
      <FileDown className="mt-1 h-6 w-6 shrink-0 text-orange-300" aria-hidden /><div className="min-w-0"><p className="text-xs text-blue-100">Temporada seleccionada</p><h2 className="mt-1 text-xl font-bold break-words">{ctx.name}</h2><p className="mt-2 max-w-prose text-sm leading-relaxed text-blue-100">Los documentos se preparan con los datos de esta temporada. Después de descargarlos puedes compartirlos por WhatsApp.</p></div>
    </section>
    <nav aria-label="Tipos de reportes" className="mb-6 flex flex-wrap gap-2">{[{ id: "jornada", label: "Documentos de la jornada" }, { id: "competencia", label: "Competencia y resultados" }, { id: "participantes", label: "Participantes y disciplina" }].map((section) => <a key={section.id} href={`#${section.id}`} className={buttonClass("secondary", "sm")}>{section.label}</a>)}</nav>

    <section id="jornada" aria-labelledby="jornada-title" className="scroll-mt-20">
      <h2 id="jornada-title" className="text-lg font-bold text-[#102d50]">Documentos de la jornada</h2><p className="mt-1 mb-4 text-sm text-slate-600">Un documento por liga. Elige la fecha del rol y de los resultados.</p>
      {days.all.length > 0 && <form key={`${ctx.id}:${dates.rolDate}:${dates.resultsDate}`} action="/reportes" method="get" aria-label="Elegir fechas de los documentos" className="mb-4 grid items-end gap-4 rounded-xl border border-slate-300 bg-slate-50 p-5 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
        <label className="min-w-0 text-sm font-semibold text-slate-700">Fecha del rol<select name="rol" defaultValue={dates.rolDate ?? ""} className="filter-control mt-2 block"><option value="">Elegir fecha</option>{dates.rolDates.map((date) => <option key={date} value={date}>{formatShort(date)}</option>)}</select></label>
        {dates.resultDates.length ? <label className="min-w-0 text-sm font-semibold text-slate-700">Fecha de resultados<select name="resultados" defaultValue={dates.resultsDate ?? ""} className="filter-control mt-2 block"><option value="">Elegir fecha</option>{dates.resultDates.map((date) => <option key={date} value={date}>{formatShort(date)}</option>)}</select></label> : <p className="text-sm text-slate-600">Aún no hay una fecha disponible para resultados.</p>}
        <button type="submit" className={buttonClass("primary")}>Aplicar fechas</button>
      </form>}
      <WhatsAppPdfs seasonId={ctx.id} leagues={leagues} rolDate={dates.rolDate} resultsDate={dates.resultsDate} />
      <p className="mt-3 text-xs leading-relaxed text-slate-600">Estos accesos usan las ligas activas con equipos activos. Para consultar otras ligas o equipos dados de baja, utiliza los reportes de abajo.</p>
    </section>
    {[{ id: "competencia" as const, title: "Competencia y resultados", description: "Consulta la programación completa, los marcadores y la fase final." }, { id: "participantes" as const, title: "Participantes y disciplina", description: "Reúne los datos de equipos y las sanciones registradas." }].map((group) => <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="mt-8 scroll-mt-20">
      <h2 id={`${group.id}-title`} className="text-lg font-bold text-[#102d50]">{group.title}</h2><p className="mt-1 mb-4 text-sm text-slate-600">{group.description}</p>
      <div className="grid items-stretch gap-4 xl:grid-cols-2">{REPORT_DOCUMENTS.filter((report) => report.group === group.id).map((report) => <ReportCard key={`${ctx.id}:${report.doc}`} report={report} seasonId={ctx.id} leagues={leagueOptions} teams={teamOptions} types={typeOptions} />)}</div>
    </section>)}
  </>;
}
