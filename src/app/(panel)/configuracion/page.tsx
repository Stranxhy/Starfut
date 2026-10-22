import { requireSeasonContext } from "@/server/season";
import { updateGeneralAction } from "@/server/actions/config";
import { GeneralForm } from "@/components/forms/config-forms";
import { Card, CardHeader, EmptyState } from "@/components/ui/core";
import { toISODate } from "@/lib/dates";

export const metadata = { title: "Configuración" };

export default async function ConfigGeneralPage() {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Sin temporada" description="Crea una temporada en la pestaña Temporadas." />;
  return (
    <Card>
      <CardHeader title="Torneo, sede y temporada" description={`Temporada seleccionada: ${ctx.name}`} />
      <div className="px-4 py-5 sm:px-5">
        <GeneralForm
          action={updateGeneralAction}
          v={{
            tournamentName: ctx.tournament.name,
            modality: ctx.tournament.modality,
            venueName: ctx.venue.name,
            seasonName: ctx.name,
            startDate: toISODate(ctx.startDate)!,
            weekday: ctx.weekday,
            regularRounds: ctx.regularRounds,
            requireReferee: ctx.requireReferee,
            allowInterLeague: ctx.allowInterLeague,
            excludedDates: ctx.excludedDates,
          }}
        />
      </div>
    </Card>
  );
}
