import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { addServingAction, removeServingAction, updateSanctionAction } from "@/server/actions/sanctions";
import { SanctionEditForm, ServingForm } from "@/components/forms/SanctionForm";
import { ConfirmAction } from "@/components/ui/form";
import { Badge, Card, CardHeader, Collapsible, EmptyState, PageHeader, StatCard, Table, TD, TH } from "@/components/ui/core";
import { AuditList } from "@/components/AuditList";
import { sanctionProgress } from "@/domain/sanctions";
import { formatLong, formatShort, toISODate } from "@/lib/dates";
import { SANCTION_STATUS, UNIT_KIND } from "@/lib/labels";
import { loadSanctionFormData } from "../data";

export default async function SancionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const s = await prisma.sanction.findUnique({
    where: { id },
    include: {
      player: true,
      team: true,
      type: true,
      unit: true,
      match: { include: { homeTeam: true, awayTeam: true } },
      servings: { include: { match: { include: { homeTeam: true, awayTeam: true } } }, orderBy: { date: "asc" } },
    },
  });
  if (!s) notFound();
  const formData = await loadSanctionFormData(s.seasonId);
  const progress = sanctionProgress(s.unit.kind, s.duration, s.servings.length);
  const teamMatches = await prisma.match.findMany({
    where: {
      OR: [{ homeTeamId: s.teamId }, { awayTeamId: s.teamId }],
      status: { not: "CANCELADO" },
      date: { gte: s.date },
      id: { notIn: s.servings.map((x) => x.matchId).filter((x): x is string => !!x) },
    },
    orderBy: { date: "asc" },
    include: { homeTeam: true, awayTeam: true },
    take: 30,
  });
  return (
    <>
      <PageHeader
        breadcrumb={[{ href: "/sanciones", label: "Sanciones" }]}
        title={`${s.player.fullName} · ${s.type.name}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {s.team.name} · {formatLong(s.date)}
            <Badge className={SANCTION_STATUS[s.status].className}>{SANCTION_STATUS[s.status].label}</Badge>
          </span>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Duración" value={`${s.duration}`} hint={`${s.unit.name} (${UNIT_KIND[s.unit.kind]})`} />
        <StatCard label="Cumplidos" value={progress.served} hint={s.unit.kind === "PARTIDOS" ? "partidos" : "registros"} />
        <StatCard label="Pendientes" value={progress.remaining ?? "—"} hint={progress.remaining === null ? "Unidad no basada en partidos" : "partidos"} tone={progress.remaining ? "warn" : "ok"} />
        <StatCard label="Partido relacionado" value={s.match ? formatShort(s.match.date) : "—"} hint={s.match ? `${s.match.homeTeam.name} vs ${s.match.awayTeam.name}` : undefined} href={s.match ? `/partidos/${s.match.id}` : undefined} />
      </div>
      <Card className="mt-5">
        <CardHeader title="Cumplimiento" description={s.unit.kind === "PARTIDOS" ? "Al completar todos los partidos, la sanción se marca como cumplida." : "Registra el cumplimiento; el estado se actualiza manualmente."} />
        {s.status !== "CANCELADA" && (
          <div className="px-4 py-4 sm:px-5">
            <ServingForm action={addServingAction} sanctionId={s.id} matches={teamMatches.map((m) => ({ value: m.id, label: `${formatShort(m.date)} · ${m.homeTeam.name} vs ${m.awayTeam.name}` }))} />
          </div>
        )}
        {s.servings.length === 0 ? (
          <EmptyState title="Sin cumplimientos registrados" />
        ) : (
          <Table>
            <thead><tr><TH>Fecha</TH><TH>Partido</TH><TH>Nota</TH><TH /></tr></thead>
            <tbody>
              {s.servings.map((x) => (
                <tr key={x.id}>
                  <TD>{formatShort(x.date)}</TD>
                  <TD>{x.match ? <Link href={`/partidos/${x.match.id}`} className="hover:underline">{x.match.homeTeam.name} vs {x.match.awayTeam.name}</Link> : "—"}</TD>
                  <TD className="text-zinc-600">{x.notes ?? "—"}</TD>
                  <TD className="text-right">
                    <ConfirmAction action={removeServingAction} hidden={{ id: x.id }} label="Eliminar" title="Eliminar cumplimiento" reason="required" confirmLabel="Eliminar" />
                  </TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <div className="mt-5 space-y-3">
        <Collapsible title="Editar sanción">
          <div className="px-4 py-4 sm:px-5">
            <SanctionEditForm
              action={updateSanctionAction}
              data={formData}
              sanction={{
                id: s.id,
                playerId: s.playerId,
                teamId: s.teamId,
                matchId: s.matchId ?? "",
                date: toISODate(s.date)!,
                typeId: s.typeId,
                unitId: s.unitId,
                duration: String(s.duration),
                status: s.status,
                reason: s.reason,
                notes: s.notes ?? "",
              }}
            />
          </div>
        </Collapsible>
        <Collapsible title="Historial de cambios">
          <AuditList entity="Sanción" entityId={s.id} />
        </Collapsible>
      </div>
    </>
  );
}
