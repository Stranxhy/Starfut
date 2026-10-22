import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { removeLeagueOverrideAction, saveScoringAction, saveTiebreakAction } from "@/server/actions/config";
import { getScoringRules, getTiebreakers } from "@/server/services/rules";
import { ScoringForm, TiebreakForm } from "@/components/forms/config-forms";
import { SimpleToggleForm } from "@/components/forms/entity-forms";
import { Alert, Card, CardHeader, EmptyState } from "@/components/ui/core";
import { TIEBREAK_CRITERIA } from "@/domain/standings";
import { SCORER_CRITERIA } from "@/domain/scorers";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Puntuación y desempates" };

export default async function ReglasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Sin temporada" />;
  const sp = await searchParams;
  const leagueId = str(sp.liga);
  const league = ctx.leagues.find((l) => l.id === leagueId);
  const [scoringOverride, tiebreakOverride, scoring, tb] = await Promise.all([
    league ? prisma.scoringConfig.findUnique({ where: { leagueId: league.id } }) : null,
    league ? prisma.tiebreakConfig.findUnique({ where: { leagueId: league.id } }) : null,
    getScoringRules(ctx.id, league?.id),
    getTiebreakers(ctx.id, league?.id),
  ]);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-zinc-600">Ámbito:</span>
        <Link href="/configuracion/reglas" className={`rounded-full px-3 py-1 font-semibold ring-1 ${!league ? "bg-brand-700 text-white ring-brand-700" : "bg-white ring-zinc-300"}`}>Toda la temporada</Link>
        {ctx.leagues.map((l) => (
          <Link key={l.id} href={`/configuracion/reglas?liga=${l.id}`} className={`rounded-full px-3 py-1 font-semibold ring-1 ${league?.id === l.id ? "bg-brand-700 text-white ring-brand-700" : "bg-white ring-zinc-300"}`}>{l.name}</Link>
        ))}
      </div>
      {league && (
        <Alert tone="info" className="mb-4">
          Reglas específicas de <strong>{league.name}</strong>. Si no se guardan reglas propias, la liga usa las de la temporada.
        </Alert>
      )}
      <Card className="mb-5">
        <CardHeader
          title="Sistema de puntuación"
          description={league ? (scoringOverride ? "Esta liga tiene puntuación propia." : "Actualmente hereda la puntuación de la temporada.") : "Aplica a todas las ligas sin regla propia."}
          actions={league && scoringOverride ? <SimpleToggleForm action={removeLeagueOverrideAction} hidden={{ leagueId: league.id, kind: "scoring" }} label="Usar la de temporada" variant="danger" /> : undefined}
        />
        <div className="px-4 py-5 sm:px-5">
          <ScoringForm action={saveScoringAction} leagueId={league?.id} v={scoring} />
        </div>
      </Card>
      <Card>
        <CardHeader
          title="Criterios de desempate"
          description={league ? (tiebreakOverride ? "Esta liga tiene criterios propios." : "Actualmente hereda los criterios de la temporada.") : "Aplica a todas las ligas sin criterios propios."}
          actions={league && tiebreakOverride ? <SimpleToggleForm action={removeLeagueOverrideAction} hidden={{ leagueId: league.id, kind: "tiebreak" }} label="Usar los de temporada" variant="danger" /> : undefined}
        />
        <div className="px-4 py-5 sm:px-5">
          <TiebreakForm
            action={saveTiebreakAction}
            leagueId={league?.id}
            criteria={tb.criteria}
            scorerCriteria={tb.scorerCriteria}
            options={Object.entries(TIEBREAK_CRITERIA).map(([value, label]) => ({ value, label }))}
            scorerOptions={Object.entries(SCORER_CRITERIA).map(([value, label]) => ({ value, label }))}
          />
        </div>
      </Card>
    </>
  );
}
