import { History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { loadAuditHistory } from "@/server/services/audit-history";
import { Alert, Card, EmptyState, inputClass, LinkButton, PageHeader, Pagination, withParams } from "@/components/ui/core";
import { FilterField, FilterPanel, FilterSelect } from "@/components/ui/filters";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { AUDIT_USER_FALLBACK, AUDIT_WITHOUT_USER, auditActionLabel, auditEntityLabel, resolveAuditView } from "@/domain/audit-view";
import { APP_TIMEZONE, formatShort } from "@/lib/dates";
import { AUDIT_ACTION } from "@/lib/labels";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Historial de cambios" };

export default async function HistorialPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const sp = await searchParams;
  const view = resolveAuditView(Object.fromEntries(Object.entries(sp).map(([key, value]) => [key, str(value)])));
  const { q, entidad, accion, usuario, desde, hasta, dateError } = view;
  const base = { q, entidad, accion, usuario, desde, hasta };
  const [{ total, logs, page, pageCount }, entities, actions, users] = await Promise.all([
    loadAuditHistory(view),
    prisma.auditLog.groupBy({ by: ["entity"], orderBy: { entity: "asc" } }),
    prisma.auditLog.groupBy({ by: ["action"], orderBy: { action: "asc" } }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  // Mantener visibles los filtros de enlaces antiguos, aunque su opción ya no exista.
  const entityOptions = [...new Set([...entities.map((item) => item.entity), ...(entidad ? [entidad] : [])])].map((value) => ({ value, label: auditEntityLabel(value) }));
  const actionOptions = [...new Set([...Object.keys(AUDIT_ACTION), ...actions.map((item) => item.action), ...(accion ? [accion] : [])])].map((value) => ({ value, label: auditActionLabel(value) }));
  const userOptions = [{ value: AUDIT_WITHOUT_USER, label: AUDIT_USER_FALLBACK }, ...users.map((user) => ({ value: user.id, label: user.name }))];
  if (usuario && !userOptions.some((option) => option.value === usuario)) userOptions.push({ value: usuario, label: "Usuario no disponible" });
  const hasFilters = Object.values(base).some(Boolean);

  return <>
    <PageHeader title="Historial de cambios" description="Consulta qué se hizo, quién lo registró y cuándo. Abre cada detalle para comparar los valores." />
    <section aria-label="Alcance del historial" className="bg-sport mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border-l-4 border-orange-400 px-5 py-5 text-white sm:px-6">
      <div className="min-w-0"><p className="text-xs text-blue-100">Todas las temporadas</p><h2 className="mt-1 text-xl font-bold">La actividad de tu liga, en orden</h2><p className="mt-2 max-w-prose text-sm leading-relaxed text-blue-100">Este historial reúne los cambios de todo el sistema, sin limitarse a la temporada seleccionada.</p></div>
      <span className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold"><History className="h-4 w-4" aria-hidden />Consulta de actividad</span>
    </section>
    {dateError && <Alert tone="warn" title="Revisa el periodo" className="mb-5">{dateError} Corrige las fechas y vuelve a aplicar los filtros.</Alert>}
    <Card className="overflow-hidden">
      <FilterPanel key={JSON.stringify(base)} path="/historial" params={base} total={total} chips={[
        { name: "q", label: "Búsqueda", value: q }, { name: "entidad", label: "Registro", value: entidad ? auditEntityLabel(entidad) : undefined },
        { name: "accion", label: "Acción", value: accion ? auditActionLabel(accion) : undefined },
        { name: "usuario", label: "Usuario", value: userOptions.find((option) => option.value === usuario)?.label },
        { name: "desde", label: "Desde", value: desde ? formatShort(desde) : undefined }, { name: "hasta", label: "Hasta", value: hasta ? formatShort(hasta) : undefined },
      ]} advancedOpen={!!(desde || hasta || dateError)} advanced={<>
        <FilterField name="desde" label="Fecha desde"><input id="desde" name="desde" type="date" defaultValue={desde} className={inputClass} aria-describedby="audit-timezone" /></FilterField>
        <FilterField name="hasta" label="Fecha hasta"><input id="hasta" name="hasta" type="date" defaultValue={hasta} className={inputClass} aria-describedby="audit-timezone" /></FilterField>
        <p id="audit-timezone" className="text-xs leading-relaxed text-slate-600 sm:col-span-2">Incluye los días completos, desde la primera fecha hasta la última.<br />Zona horaria: {APP_TIMEZONE.replace(/_/g, " ")}.</p>
      </>}>
        <FilterField name="q" label="Buscar en el historial"><input id="q" name="q" type="search" defaultValue={q} className={inputClass} placeholder="Resumen o motivo del cambio" /></FilterField>
        <FilterSelect name="entidad" label="Tipo de registro" value={entidad} options={entityOptions} all="Todos los registros" />
        <FilterSelect name="accion" label="Acción realizada" value={accion} options={actionOptions} all="Todas las acciones" />
        <FilterSelect name="usuario" label="Registrado por" value={usuario} options={userOptions} all="Todos los usuarios" />
      </FilterPanel>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-4 sm:px-5"><h2 className="text-sm font-bold text-[#102d50]">{hasFilters ? "Actividad encontrada" : "Actividad registrada"}</h2><p className="text-xs text-slate-600">Más reciente primero</p></div>
      {logs.length > 0 ? <AuditTimeline logs={logs} linkRecords /> : <EmptyState
        title={dateError ? "Corrige las fechas para consultar el historial" : hasFilters ? "No hay cambios con estos filtros" : "Todavía no hay cambios registrados"}
        description={dateError ? "La lista se mostrará cuando el periodo sea válido." : hasFilters ? "Prueba con otro usuario, amplía las fechas o quita algún filtro." : "Las altas, ediciones y demás acciones registradas aparecerán aquí con su fecha y usuario."}
        action={hasFilters || dateError ? <LinkButton href="/historial" variant="secondary">Quitar filtros</LinkButton> : undefined} />}
      <div className="border-t border-slate-200"><Pagination page={page} pageCount={pageCount} total={total} hrefFor={(next) => withParams("/historial", { ...base, page: next })} /></div>
    </Card>
    <p className="mt-4 text-xs leading-relaxed text-slate-600">Los valores del detalle corresponden al momento de cada acción. “Abrir registro actual” muestra su estado más reciente.</p>
  </>;
}
