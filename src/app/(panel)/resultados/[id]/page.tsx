import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { MATCH_INCLUDE } from "@/server/services/matches";
import { getScoringRules } from "@/server/services/rules";
import { revertResultAction, saveResultAction } from "@/server/actions/results";
import { ResultForm } from "@/components/forms/ResultForm";
import { ConfirmAction } from "@/components/ui/form";
import { Alert, Card, CardHeader, Collapsible, LinkButton, PageHeader } from "@/components/ui/core";
import { StatusBadge, TypeBadge } from "@/components/match-ui";
import { AuditList } from "@/components/AuditList";
import { formatLong, toISODate } from "@/lib/dates";

async function roster(teamId: string, extraIds: string[]) {
  return prisma.player.findMany({
    where: { OR: [{ teamId, active: true }, { history: { some: { teamId } } }, { id: { in: extraIds } }] },
    orderBy: [{ jerseyNumber: "asc" }, { fullName: "asc" }],
    select: { id: true, fullName: true, jerseyNumber: true },
  });
}

export default async function ResultadoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const m = await prisma.match.findUnique({ where: { id }, include: { ...MATCH_INCLUDE, scorers: true, playoffTie: true } });
  if (!m) notFound();
  const sameLeague = m.homeTeam.leagueId === m.awayTeam.leagueId;
  const [rules, home, away] = await Promise.all([
    getScoringRules(m.seasonId, sameLeague ? m.leagueId : null),
    roster(m.homeTeamId, m.scorers.filter((s) => s.teamId === m.homeTeamId).map((s) => s.playerId)),
    roster(m.awayTeamId, m.scorers.filter((s) => s.teamId === m.awayTeamId).map((s) => s.playerId)),
  ]);
  const date = toISODate(m.date);
  const blocked = m.status === "CANCELADO" || m.status === "PENDIENTE";
  return (
    <>
      <PageHeader
        breadcrumb={[{ href: date ? `/resultados?date=${date}` : "/resultados", label: "Resultados" }]}
        title={`${m.homeTeam.name} vs ${m.awayTeam.name}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {m.date ? formatLong(m.date) : "Sin fecha"} · {m.timeSlot?.startTime ?? "—"} · {m.field?.name ?? "—"}
            <StatusBadge status={m.status} />
            <TypeBadge type={m.type} counts={m.countsForStandings} />
          </span>
        }
        actions={<LinkButton href={`/partidos/${m.id}`} variant="secondary">Ver partido</LinkButton>}
      />
      {!m.countsForStandings && m.stage === "REGULAR" && (
        <Alert tone="info" className="mb-4">Este partido no altera la clasificación oficial. Sus goles no cuentan para la tabla de goleo oficial.</Alert>
      )}
      {m.playoffTie && (
        <Alert tone="info" className="mb-4">Partido de eliminatoria: el ganador avanza automáticamente a la siguiente ronda configurada.</Alert>
      )}
      {blocked ? (
        <Alert tone="warn">
          {m.status === "CANCELADO" ? "El partido está cancelado; no se puede registrar resultado." : "El partido no está programado; prográmalo antes de registrar el resultado."}
        </Alert>
      ) : (
        <Card>
          <CardHeader
            title={m.result ? "Corregir resultado oficial" : "Registrar resultado"}
            description="Marcador del tiempo regular. Los goles de penales se registran aparte y no suman a goles a favor ni al goleo."
            actions={
              m.result ? (
                <ConfirmAction
                  action={revertResultAction}
                  hidden={{ matchId: m.id }}
                  label="Revertir resultado"
                  title="Revertir resultado"
                  description="Se eliminará el resultado y sus goleadores; la tabla y el goleo se recalcularán. El cambio queda en el historial."
                  reason="required"
                  confirmLabel="Revertir"
                />
              ) : undefined
            }
          />
          <div className="px-4 py-5 sm:px-5">
            <ResultForm
              action={saveResultAction}
              match={{ id: m.id, homeTeam: m.homeTeam, awayTeam: m.awayTeam, isPlayoff: !!m.playoffTie || m.stage !== "REGULAR" }}
              existing={m.result}
              existingScorers={m.scorers.map((s) => ({ playerId: s.playerId, teamId: s.teamId, goals: s.goals }))}
              rosters={{ home, away }}
              rules={{ allowDraws: rules.allowDraws, drawPoints: rules.drawPoints, shootoutKicks: rules.shootoutKicks }}
            />
          </div>
        </Card>
      )}
      <Collapsible title="Historial de capturas y correcciones" className="mt-5">
        <AuditList entity="Partido" entityId={m.id} />
      </Collapsible>
    </>
  );
}
