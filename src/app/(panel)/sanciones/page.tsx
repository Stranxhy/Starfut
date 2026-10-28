import { FileDown, ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { createSanctionAction } from "@/server/actions/sanctions";
import { SanctionCreateButton } from "@/components/forms/SanctionForm";
import { SanctionsDirectory } from "@/components/sanctions/SanctionsDirectory";
import { Alert, Card, EmptyState, inputClass, LinkButton, PageHeader, Pagination, withParams } from "@/components/ui/core";
import { formatShort } from "@/lib/dates";
import { SANCTION_STATUS } from "@/lib/labels";
import { PAGE_SIZE, str, type SP } from "@/lib/params";
import { directoryPage } from "@/domain/filters";
import { resolveSanctionsView, sanctionsPdfHref, sanctionsWhere } from "@/domain/sanctions-view";
import { loadSanctionFormData } from "./data";
import { FilterField, FilterPanel, FilterSelect } from "@/components/ui/filters";
import { SearchableFilter } from "@/components/ui/SearchableFilter";

export const metadata = { title: "Sanciones" };

export default async function SancionesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Prepara la temporada para llevar las sanciones" description="Las sanciones se asocian a un jugador y conservan el equipo con el que ocurrieron." action={<LinkButton href="/configuracion/temporadas">Configurar temporada</LinkButton>} />;
  const [sp, formData, counts] = await Promise.all([
    searchParams, loadSanctionFormData(ctx.id),
    prisma.sanction.groupBy({ by: ["status"], where: { seasonId: ctx.id }, _count: true }),
  ]);
  const view = resolveSanctionsView(Object.fromEntries(Object.entries(sp).map(([key, value]) => [key, str(value)])), ctx.leagues.map((league) => league.id), formData.teams, formData.filterTypes.map((type) => type.value));
  const { q, liga, equipo, tipo, estado, desde, hasta, dateError } = view;
  const base = { q, liga, equipo, tipo, estado, desde, hasta };
  const where = sanctionsWhere(ctx.id, view);
  const total = await prisma.sanction.count({ where });
  const { page, pageCount, skip } = directoryPage(view.requestedPage, total, PAGE_SIZE);
  const sanctions = await prisma.sanction.findMany({ where, orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "asc" }], skip, take: PAGE_SIZE, select: {
    id: true, date: true, reason: true, duration: true, status: true,
    player: { select: { id: true, fullName: true } },
    team: { select: { id: true, name: true, active: true, league: { select: { name: true } } } },
    type: { select: { name: true } }, unit: { select: { name: true, kind: true } }, _count: { select: { servings: true } },
  } });
  const seasonTotal = counts.reduce((sum, row) => sum + row._count, 0);
  const count = (statuses: string[]) => counts.filter((row) => statuses.includes(row.status)).reduce((sum, row) => sum + row._count, 0);
  const selectedTeam = formData.teams.find((team) => team.id === equipo);
  const selectedLeague = ctx.leagues.find((league) => league.id === liga);
  const pdfHref = sanctionsPdfHref(ctx.id, view);
  const hasPlayers = formData.teams.some((team) => team.players.length > 0);
  const hasCatalogs = formData.types.length > 0 && formData.units.length > 0;
  const createAction = !hasPlayers ? <LinkButton href="/jugadores">Registrar jugadores</LinkButton>
    : !hasCatalogs ? <LinkButton href="/configuracion/catalogos">Configurar tipos y unidades</LinkButton>
    : <SanctionCreateButton action={createSanctionAction} data={formData} />;

  return <>
    <PageHeader title="Sanciones" description="Consulta los motivos, revisa el estado de cada caso y lleva el seguimiento de su cumplimiento."
      actions={<>{pdfHref && <LinkButton href={pdfHref} target="_blank" variant="secondary"><FileDown className="h-4 w-4" aria-hidden />PDF {Object.values(base).some(Boolean) ? "filtrado" : "completo"}</LinkButton>}{createAction}</>} />
    <section aria-label="Resumen de sanciones de toda la temporada" className="mb-5 overflow-hidden rounded-xl border border-slate-300 bg-white">
      <div className="bg-sport flex flex-wrap items-center justify-between gap-4 border-l-4 border-orange-400 px-5 py-5 text-white sm:px-6">
        <div className="min-w-0"><p className="text-xs font-medium text-blue-100">{ctx.name}</p><h2 className="mt-1 text-xl font-bold">Control disciplinario</h2><p className="mt-2 text-sm leading-relaxed text-blue-100">Resumen de toda la temporada. Los filtros se aplican a la lista y al PDF.</p></div>
        <span className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold"><ShieldAlert className="h-4 w-4" aria-hidden />{seasonTotal} {seasonTotal === 1 ? "sanción registrada" : "sanciones registradas"}</span>
      </div>
      <dl className="grid gap-4 px-5 py-4 sm:grid-cols-3 sm:px-6">
        <div><dt className="text-xs font-semibold text-slate-600">Por atender</dt><dd className="mt-1 text-2xl font-bold text-amber-800 tabular-nums">{count(["ACTIVA", "PENDIENTE", "EN_REVISION"])}</dd><dd className="mt-1 text-xs text-slate-600">Activas, pendientes y en revisión</dd></div>
        <div><dt className="text-xs font-semibold text-slate-600">Cumplidas</dt><dd className="mt-1 text-2xl font-bold text-[#102d50] tabular-nums">{count(["CUMPLIDA"])}</dd><dd className="mt-1 text-xs text-slate-600">Con estado Cumplida</dd></div>
        <div><dt className="text-xs font-semibold text-slate-600">Canceladas</dt><dd className="mt-1 text-2xl font-bold text-slate-600 tabular-nums">{count(["CANCELADA"])}</dd><dd className="mt-1 text-xs text-slate-600">Conservadas en el historial</dd></div>
      </dl>
    </section>
    {dateError && <Alert tone="warn" title="Revisa el periodo" className="mb-5">{dateError} Corrige las fechas y aplica los filtros para consultar o exportar los resultados.</Alert>}
    <Card>
      <FilterPanel key={JSON.stringify(base)} path="/sanciones" params={base} total={total} chips={[
        { name: "q", label: "Jugador", value: q }, { name: "liga", label: "Liga", value: selectedLeague?.name },
        { name: "equipo", label: "Equipo", value: selectedTeam?.name }, { name: "estado", label: "Estado", value: estado ? SANCTION_STATUS[estado].label : undefined },
        { name: "tipo", label: "Tipo", value: formData.filterTypes.find((type) => type.value === tipo)?.label },
        { name: "desde", label: "Desde", value: desde ? formatShort(desde) : undefined }, { name: "hasta", label: "Hasta", value: hasta ? formatShort(hasta) : undefined },
      ]} advancedOpen={!!(tipo || desde || hasta || dateError)} advanced={<>
        <FilterSelect name="tipo" label="Tipo de sanción" value={tipo} options={formData.filterTypes} all="Todos los tipos" />
        <FilterField name="desde" label="Fecha desde"><input id="desde" type="date" name="desde" defaultValue={desde} className={inputClass} /></FilterField>
        <FilterField name="hasta" label="Fecha hasta"><input id="hasta" type="date" name="hasta" defaultValue={hasta} className={inputClass} /></FilterField>
      </>}>
        <FilterField name="q" label="Nombre del jugador"><input id="q" name="q" type="search" defaultValue={q} className={inputClass} placeholder="Buscar jugador por nombre" /></FilterField>
        <FilterSelect name="liga" label="Liga de la sanción" value={liga} all="Todas las ligas" options={ctx.leagues.map((league) => ({ value: league.id, label: league.name }))} />
        <SearchableFilter name="equipo" label="Equipo de la sanción" value={equipo} all="Todos los equipos" options={formData.teams.map((team) => ({ value: team.id, label: `${team.name} (${team.leagueName})${team.active ? "" : " · Baja"}` }))} />
        <FilterSelect name="estado" label="Estado" value={estado} all="Todos los estados" options={Object.entries(SANCTION_STATUS).map(([value, info]) => ({ value, label: info.label }))} />
      </FilterPanel>
      {sanctions.length > 0 ? <SanctionsDirectory sanctions={sanctions} /> : <EmptyState
        title={dateError ? "Corrige las fechas para consultar sanciones" : seasonTotal > 0 ? "No hay sanciones con estos filtros" : "Sin sanciones registradas"}
        description={dateError ? "La lista se mostrará cuando el periodo sea válido." : seasonTotal > 0 ? "Amplía el periodo o quita algún filtro para encontrar otros registros." : "Al registrar una sanción podrás consultar su motivo, duración y seguimiento en una sola ficha."}
        action={seasonTotal > 0 || dateError ? <LinkButton href="/sanciones" variant="secondary">Quitar filtros</LinkButton> : createAction} />}
      <Pagination page={page} pageCount={pageCount} total={total} hrefFor={(next) => withParams("/sanciones", { ...base, page: next })} />
    </Card>
    <p className="mt-4 text-xs leading-relaxed text-slate-600">La liga y el equipo corresponden a la sanción, aunque el jugador haya cambiado de equipo. El PDF incluye todos los resultados de los filtros aplicados, no solo esta página.</p>
  </>;
}
