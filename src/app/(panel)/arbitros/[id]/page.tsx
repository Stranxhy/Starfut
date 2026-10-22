import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { getSeasonContext, getSeasonId } from "@/server/season";
import { MATCH_INCLUDE, sortMatches } from "@/server/services/matches";
import { addAvailabilityAction, deleteAvailabilityAction, setRefereeActiveAction, updateRefereeAction } from "@/server/actions/people";
import { AvailabilityForm, RefereeEditForm, SimpleToggleForm } from "@/components/forms/entity-forms";
import { Badge, Card, CardHeader, Collapsible, EmptyState, PageHeader, StatCard, Table, TD, TH } from "@/components/ui/core";
import { ScoreText, StatusBadge } from "@/components/match-ui";
import { AuditList } from "@/components/AuditList";
import { formatShort, fromISODate, todayISO } from "@/lib/dates";

export default async function ArbitroPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const referee = await prisma.referee.findUnique({
    where: { id },
    include: { availabilities: { include: { timeSlot: true }, orderBy: { date: "desc" }, take: 60 } },
  });
  if (!referee) notFound();
  const seasonId = await getSeasonId();
  const ctx = seasonId ? await getSeasonContext(seasonId) : null;
  const today = fromISODate(todayISO());
  const matches = sortMatches(
    await prisma.match.findMany({ where: { refereeId: id, ...(seasonId ? { seasonId } : {}), status: { not: "CANCELADO" } }, include: MATCH_INCLUDE }),
  );
  const upcoming = matches.filter((m) => m.status !== "JUGADO" && m.date && m.date >= today);
  const past = matches.filter((m) => m.status === "JUGADO").reverse();

  return (
    <>
      <PageHeader
        breadcrumb={[{ href: "/arbitros", label: "Árbitros" }]}
        title={
          <span className="flex items-center gap-2">
            {referee.name} {!referee.active && <Badge>Inactivo</Badge>}
          </span>
        }
        actions={
          <SimpleToggleForm
            action={setRefereeActiveAction}
            hidden={{ id: referee.id, active: referee.active ? "0" : "1" }}
            label={referee.active ? "Desactivar" : "Activar"}
            variant={referee.active ? "danger" : "secondary"}
          />
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Partidos arbitrados" value={past.length} hint="Temporada seleccionada" />
        <StatCard label="Asignaciones futuras" value={upcoming.length} />
        <StatCard label="Registros de disponibilidad" value={referee.availabilities.length} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Asignaciones futuras" />
          {upcoming.length === 0 ? (
            <EmptyState title="Sin asignaciones" />
          ) : (
            <Table>
              <thead><tr><TH>Fecha</TH><TH>Hora</TH><TH>Cancha</TH><TH>Partido</TH><TH>Estado</TH></tr></thead>
              <tbody>
                {upcoming.map((m) => (
                  <tr key={m.id}>
                    <TD>{formatShort(m.date)}</TD>
                    <TD>{m.timeSlot?.startTime ?? "—"}</TD>
                    <TD>{m.field?.name ?? "—"}</TD>
                    <TD><Link href={`/partidos/${m.id}`} className="font-semibold hover:underline">{m.homeTeam.name} vs {m.awayTeam.name}</Link></TD>
                    <TD><StatusBadge status={m.status} /></TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader title="Partidos arbitrados" />
          {past.length === 0 ? (
            <EmptyState title="Sin partidos arbitrados" />
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <thead><tr><TH>Fecha</TH><TH>Partido</TH><TH className="text-center">Marcador</TH></tr></thead>
                <tbody>
                  {past.map((m) => (
                    <tr key={m.id}>
                      <TD>{formatShort(m.date)}</TD>
                      <TD><Link href={`/partidos/${m.id}`} className="hover:underline">{m.homeTeam.name} vs {m.awayTeam.name}</Link></TD>
                      <TD className="text-center"><ScoreText result={m.result} homeTeamId={m.homeTeamId} /></TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader title="Disponibilidad" description="Fechas u horarios en que no puede asistir." />
        <div className="px-4 py-4 sm:px-5">
          <AvailabilityForm action={addAvailabilityAction} refereeId={referee.id} slots={(ctx?.timeSlots ?? []).map((t) => ({ value: t.id, label: t.startTime }))} />
        </div>
        {referee.availabilities.length > 0 && (
          <Table>
            <thead><tr><TH>Fecha</TH><TH>Horario</TH><TH>Estado</TH><TH>Nota</TH><TH /></tr></thead>
            <tbody>
              {referee.availabilities.map((a) => (
                <tr key={a.id}>
                  <TD>{formatShort(a.date)}</TD>
                  <TD>{a.timeSlot?.startTime ?? "Todo el día"}</TD>
                  <TD>{a.available ? <Badge className="bg-emerald-100 text-emerald-900 ring-emerald-300">Disponible</Badge> : <Badge className="bg-red-100 text-red-900 ring-red-300">No disponible</Badge>}</TD>
                  <TD className="text-zinc-600">{a.note ?? "—"}</TD>
                  <TD className="text-right"><SimpleToggleForm action={deleteAvailabilityAction} hidden={{ id: a.id }} label="Eliminar" variant="danger" /></TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="mt-5 space-y-3">
        <Collapsible title="Editar datos del árbitro">
          <div className="px-4 py-4 sm:px-5">
            <RefereeEditForm action={updateRefereeAction} referee={referee} />
          </div>
        </Collapsible>
        <Collapsible title="Historial de cambios">
          <AuditList entity="Árbitro" entityId={referee.id} />
        </Collapsible>
      </div>
    </>
  );
}
