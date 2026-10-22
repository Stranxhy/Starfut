import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { addFieldBlockAction, deleteFieldBlockAction, saveFieldAction, saveTimeSlotAction, toggleFieldAction, toggleTimeSlotAction } from "@/server/actions/config";
import { FieldBlockForm, FieldForm, TimeSlotForm } from "@/components/forms/config-forms";
import { SimpleToggleForm } from "@/components/forms/entity-forms";
import { Badge, Card, CardHeader, EmptyState, Table, TD, TH } from "@/components/ui/core";
import { formatShort, fromISODate, todayISO } from "@/lib/dates";

export const metadata = { title: "Horarios y canchas" };

export default async function HorariosCanchasPage() {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Sin temporada" />;
  const blocks = await prisma.fieldBlock.findMany({
    where: { field: { venueId: ctx.venueId }, date: { gte: fromISODate(todayISO()) } },
    include: { field: true, timeSlot: true },
    orderBy: { date: "asc" },
  });
  const activeSlots = ctx.timeSlots.filter((t) => t.active).length;
  const activeFields = ctx.venue.fields.filter((f) => f.active).length;
  return (
    <>
      <p className="mb-4 text-sm text-zinc-600">
        Capacidad por fecha: <strong>{activeSlots}</strong> horarios × <strong>{activeFields}</strong> canchas = <strong>{activeSlots * activeFields}</strong> espacios de partido.
      </p>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Horarios" description="Horarios de inicio de los partidos de la temporada." />
          <div className="border-b border-zinc-100 px-4 py-3 sm:px-5"><TimeSlotForm action={saveTimeSlotAction} /></div>
          <Table>
            <thead><tr><TH>Inicio · duración</TH><TH>Estado</TH><TH /></tr></thead>
            <tbody>
              {ctx.timeSlots.map((t) => (
                <tr key={t.id}>
                  <TD><TimeSlotForm action={saveTimeSlotAction} slot={t} /></TD>
                  <TD>{t.active ? <Badge className="bg-emerald-100 text-emerald-900 ring-emerald-300">Activo</Badge> : <Badge>Inactivo</Badge>}</TD>
                  <TD className="text-right"><SimpleToggleForm action={toggleTimeSlotAction} hidden={{ id: t.id }} label={t.active ? "Desactivar" : "Activar"} variant={t.active ? "danger" : "secondary"} /></TD>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader title={`Canchas · ${ctx.venue.name}`} description="Las canchas pertenecen a la sede." />
          <div className="border-b border-zinc-100 px-4 py-3 sm:px-5"><FieldForm action={saveFieldAction} /></div>
          <Table>
            <thead><tr><TH>Nombre · orden</TH><TH>Estado</TH><TH /></tr></thead>
            <tbody>
              {ctx.venue.fields.map((f) => (
                <tr key={f.id}>
                  <TD><FieldForm action={saveFieldAction} field={f} /></TD>
                  <TD>{f.active ? <Badge className="bg-emerald-100 text-emerald-900 ring-emerald-300">Activa</Badge> : <Badge>Inactiva</Badge>}</TD>
                  <TD className="text-right"><SimpleToggleForm action={toggleFieldAction} hidden={{ id: f.id }} label={f.active ? "Desactivar" : "Activar"} variant={f.active ? "danger" : "secondary"} /></TD>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
      <Card className="mt-5">
        <CardHeader title="Bloqueos de canchas" description="Fechas u horarios en que una cancha no está disponible (mantenimiento, eventos). El generador y la validación manual los respetan." />
        <div className="px-4 py-4 sm:px-5">
          <FieldBlockForm action={addFieldBlockAction} fields={ctx.venue.fields.map((f) => ({ value: f.id, label: f.name }))} slots={ctx.timeSlots.map((t) => ({ value: t.id, label: t.startTime }))} />
        </div>
        {blocks.length > 0 && (
          <Table>
            <thead><tr><TH>Fecha</TH><TH>Cancha</TH><TH>Horario</TH><TH>Motivo</TH><TH /></tr></thead>
            <tbody>
              {blocks.map((b) => (
                <tr key={b.id}>
                  <TD>{formatShort(b.date)}</TD>
                  <TD>{b.field.name}</TD>
                  <TD>{b.timeSlot?.startTime ?? "Todo el día"}</TD>
                  <TD className="text-zinc-600">{b.reason ?? "—"}</TD>
                  <TD className="text-right"><SimpleToggleForm action={deleteFieldBlockAction} hidden={{ id: b.id }} label="Eliminar" variant="danger" /></TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
