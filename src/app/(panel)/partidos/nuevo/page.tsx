import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { createMatchAction } from "@/server/actions/matches";
import { MATCH_INCLUDE, substituteCandidates } from "@/server/services/matches";
import { MatchForm } from "@/components/forms/MatchForm";
import { Alert, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/core";
import { formatLong, toISODate } from "@/lib/dates";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Nuevo partido" };

export default async function NuevoPartidoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Sin temporada" />;
  const sp = await searchParams;
  const replacesId = str(sp.sustituye);
  const replaced = replacesId ? await prisma.match.findUnique({ where: { id: replacesId }, include: MATCH_INCLUDE }) : null;
  const [teams, candidates] = await Promise.all([
    prisma.team.findMany({ where: { seasonId: ctx.id }, orderBy: { name: "asc" }, include: { league: { select: { name: true } } } }),
    replaced ? substituteCandidates(replaced.id) : Promise.resolve(undefined),
  ]);
  return (
    <>
      <PageHeader
        breadcrumb={[{ href: "/partidos", label: "Partidos" }]}
        title={replaced ? "Partido de sustitución" : "Nuevo partido"}
        description="Define la naturaleza del encuentro antes de confirmarlo: solo los partidos oficiales y de sustitución alteran la clasificación."
      />
      {replaced && (
        <Alert tone="info" className="mb-4" title="Aprovechar el espacio de un partido cancelado">
          {replaced.homeTeam.name} vs {replaced.awayTeam.name} · {formatLong(replaced.date)} {replaced.timeSlot?.startTime} · {replaced.field?.name}
          {replaced.cancelReason && <span className="block text-xs">Motivo de cancelación: {replaced.cancelReason}</span>}
        </Alert>
      )}
      {replaced && replaced.status !== "CANCELADO" ? (
        <Alert tone="danger">Solo se puede sustituir un partido cancelado.</Alert>
      ) : (
        <Card>
          <CardHeader title="Datos del partido" />
          <div className="px-4 py-4 sm:px-5">
            <MatchForm
              action={createMatchAction}
              mode="create"
              teams={teams.map((t) => ({ id: t.id, name: t.name, leagueId: t.leagueId, leagueName: t.league.name, active: t.active }))}
              slots={ctx.timeSlots.filter((t) => t.active)}
              fields={ctx.venue.fields.filter((f) => f.active)}
              replacesMatchId={replaced?.id}
              candidates={candidates}
              allowedTypes={replaced ? ["SUSTITUCION", "AMISTOSO", "INTERLIGA"] : undefined}
              initial={{
                date: replaced ? toISODate(replaced.date) : (str(sp.fecha) ?? null),
                timeSlotId: replaced?.timeSlotId,
                fieldId: replaced?.fieldId,
                homeTeamId: replaced ? undefined : undefined,
              }}
            />
          </div>
        </Card>
      )}
    </>
  );
}
