import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { addFieldBlockAction, deleteFieldBlockAction, saveFieldAction, saveTimeSlotAction, toggleFieldAction, toggleTimeSlotAction } from "@/server/actions/config";
import { FieldBlockForm, FieldForm, TimeSlotForm } from "@/components/forms/config-forms";
import { SimpleToggleForm } from "@/components/forms/entity-forms";
import { ConfigContext } from "@/components/config/ConfigContext";
import { Badge, Card, CardHeader, EmptyState, LinkButton } from "@/components/ui/core";
import { formatShort, fromISODate, todayISO } from "@/lib/dates";

export const metadata = { title: "Horarios y canchas" };

export default async function HorariosCanchasPage() {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Crea una temporada para definir sus horarios" action={<LinkButton href="/configuracion/temporadas">Ir a Temporadas</LinkButton>} />;
  const blocks = await prisma.fieldBlock.findMany({ where: { field: { venueId: ctx.venueId }, date: { gte: fromISODate(todayISO()) } }, include: { field: { select: { name: true } }, timeSlot: { select: { startTime: true } } }, orderBy: [{ date: "asc" }, { id: "asc" }] });
  const activeSlots = ctx.timeSlots.filter((slot) => slot.active).length;
  const activeFields = ctx.venue.fields.filter((field) => field.active).length;
  return <>
    <ConfigContext context={ctx.name} title="Horarios y canchas" description="Los horarios pertenecen a esta temporada. Las canchas y sus bloqueos se comparten con la sede.">
      <p className="mt-4 inline-block rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm"><strong>{activeSlots}</strong> horarios × <strong>{activeFields}</strong> canchas = <strong>{activeSlots * activeFields}</strong> espacios por fecha, antes de bloqueos.</p>
    </ConfigContext>
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Card className="min-w-0 overflow-hidden" aria-labelledby="horarios-title">
        <CardHeader title={<span id="horarios-title">Horarios de juego</span>} description="Hora de inicio y duración de cada espacio." />
        <div className="border-y border-slate-200 bg-slate-50 p-5"><TimeSlotForm action={saveTimeSlotAction} /></div>
        {ctx.timeSlots.length ? <ul className="divide-y divide-slate-200">{ctx.timeSlots.map((slot) => <li key={slot.id} className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><Badge className={slot.active ? "bg-emerald-50 text-emerald-900 ring-emerald-300" : "bg-slate-100 text-slate-600 ring-slate-300"}>{slot.active ? "Activo" : "Inactivo"}</Badge><SimpleToggleForm action={toggleTimeSlotAction} hidden={{ id: slot.id }} label={slot.active ? "Desactivar horario" : "Activar horario"} variant={slot.active ? "danger" : "secondary"} /></div>
          <TimeSlotForm key={`${slot.id}:${slot.startTime}:${slot.durationMinutes}`} action={saveTimeSlotAction} slot={slot} />
        </li>)}</ul> : <p className="p-5 text-sm text-slate-600">Agrega el primer horario para empezar a organizar la jornada.</p>}
      </Card>
      <Card id="canchas" className="min-w-0 scroll-mt-20 overflow-hidden" aria-labelledby="canchas-title">
        <CardHeader title={<span id="canchas-title">Canchas de {ctx.venue.name}</span>} description="El orden define cómo aparecen al programar partidos." />
        <div className="border-y border-slate-200 bg-slate-50 p-5"><FieldForm action={saveFieldAction} /></div>
        {ctx.venue.fields.length ? <ul className="divide-y divide-slate-200">{ctx.venue.fields.map((field) => <li key={field.id} className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><Badge className={field.active ? "bg-emerald-50 text-emerald-900 ring-emerald-300" : "bg-slate-100 text-slate-600 ring-slate-300"}>{field.active ? "Activa" : "Inactiva"}</Badge><SimpleToggleForm action={toggleFieldAction} hidden={{ id: field.id }} label={field.active ? "Desactivar cancha" : "Activar cancha"} variant={field.active ? "danger" : "secondary"} /></div>
          <FieldForm key={`${field.id}:${field.name}:${field.sortOrder}`} action={saveFieldAction} field={field} />
        </li>)}</ul> : <p className="p-5 text-sm text-slate-600">Registra las canchas disponibles en esta sede.</p>}
      </Card>
    </div>
    <Card className="mt-5 overflow-hidden">
      <CardHeader title="Bloqueos de canchas" description="Reserva una fecha o un horario para mantenimiento u otros eventos. Se muestran los bloqueos de hoy en adelante." />
      {ctx.venue.fields.length > 0 ? <div className="border-y border-slate-200 bg-slate-50 p-5"><FieldBlockForm action={addFieldBlockAction} fields={ctx.venue.fields.map((field) => ({ value: field.id, label: field.name }))} slots={ctx.timeSlots.map((slot) => ({ value: slot.id, label: slot.startTime }))} /></div> : <p className="p-5 text-sm text-slate-600">Agrega una cancha antes de registrar bloqueos.</p>}
      {blocks.length ? <ul className="divide-y divide-slate-200">{blocks.map((block) => <li key={block.id} className="flex flex-wrap items-start justify-between gap-4 p-5"><div className="min-w-0"><p className="text-sm font-bold break-words text-[#102d50]">{block.field.name}</p><p className="mt-1 text-xs font-semibold text-slate-600">{formatShort(block.date)} · {block.timeSlot?.startTime ?? "Todo el día"}</p><p className="mt-2 text-sm leading-relaxed break-words text-slate-600">{block.reason || "Sin motivo adicional."}</p></div><SimpleToggleForm action={deleteFieldBlockAction} hidden={{ id: block.id }} label="Eliminar bloqueo" variant="danger" /></li>)}</ul> : <p className="p-5 text-sm text-slate-600">No hay bloqueos próximos registrados.</p>}
    </Card>
  </>;
}
