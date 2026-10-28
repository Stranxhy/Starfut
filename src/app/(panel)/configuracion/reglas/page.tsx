import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { removeLeagueOverrideAction, saveScoringAction, saveTiebreakAction } from "@/server/actions/config";
import { getScoringRules, getTiebreakers } from "@/server/services/rules";
import { ScoringForm, TiebreakForm } from "@/components/forms/config-forms";
import { SimpleToggleForm } from "@/components/forms/entity-forms";
import { Alert, Card, CardHeader, EmptyState, LinkButton } from "@/components/ui/core";
import { TIEBREAK_CRITERIA } from "@/domain/standings";
import { SCORER_CRITERIA } from "@/domain/scorers";
import { str, type SP } from "@/lib/params";
import { LeagueTabs } from "@/components/ui/filters";
import { ConfigContext } from "@/components/config/ConfigContext";

export const metadata = { title: "Puntuación y desempates" };

export default async function ReglasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Crea una temporada para definir sus reglas" action={<LinkButton href="/configuracion/temporadas">Ir a Temporadas</LinkButton>} />;
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
      <ConfigContext context={ctx.name} title="Puntuación y desempates" description="Ajusta las reglas de toda la temporada o define excepciones para una liga. El ámbito seleccionado se indica en cada formulario." />
      <LeagueTabs path="/configuracion/reglas" leagues={[{ id: "", name: "Toda la temporada" }, ...ctx.leagues]} selected={league?.id ?? ""} />
      {league && (
        <Alert tone="info" className="mb-4">
          Reglas específicas de <strong>{league.name}</strong>. Si no se guardan reglas propias, la liga usa las de la temporada.
        </Alert>
      )}
      <Card className="mb-5">
        <CardHeader
          title={`Puntuación: ${league?.name ?? "toda la temporada"}`}
          description={league ? (scoringOverride ? "Esta liga tiene puntuación propia." : "Actualmente hereda la puntuación de la temporada.") : "Aplica a todas las ligas sin regla propia."}
          actions={league && scoringOverride ? <SimpleToggleForm action={removeLeagueOverrideAction} hidden={{ leagueId: league.id, kind: "scoring" }} label="Usar la de temporada" variant="danger" /> : undefined}
        />
        <div className="px-4 py-5 sm:px-5">
          <ScoringForm key={`${ctx.id}:${league?.id ?? "global"}:${JSON.stringify(scoring)}`} action={saveScoringAction} leagueId={league?.id} v={scoring} />
        </div>
      </Card>
      <Card>
        <CardHeader
          title={`Desempates: ${league?.name ?? "toda la temporada"}`}
          description={league ? (tiebreakOverride ? "Esta liga tiene criterios propios." : "Actualmente hereda los criterios de la temporada.") : "Aplica a todas las ligas sin criterios propios."}
          actions={league && tiebreakOverride ? <SimpleToggleForm action={removeLeagueOverrideAction} hidden={{ leagueId: league.id, kind: "tiebreak" }} label="Usar los de temporada" variant="danger" /> : undefined}
        />
        <div className="px-4 py-5 sm:px-5">
          <TiebreakForm
            key={`${ctx.id}:${league?.id ?? "global"}:${JSON.stringify(tb)}`}
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
