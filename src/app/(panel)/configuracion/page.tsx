import { requireSeasonContext } from "@/server/season";
import { updateGeneralAction } from "@/server/actions/config";
import { GeneralForm } from "@/components/forms/config-forms";
import { ConfigContext } from "@/components/config/ConfigContext";
import { Card, EmptyState, LinkButton } from "@/components/ui/core";
import { toISODate } from "@/lib/dates";

export const metadata = { title: "Configuración general" };

export default async function ConfigGeneralPage() {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Crea la primera temporada" description="Después podrás ajustar sus jornadas, horarios y reglas de competencia." action={<LinkButton href="/configuracion/temporadas">Ir a Temporadas</LinkButton>} />;
  const values = { tournamentName: ctx.tournament.name, modality: ctx.tournament.modality, venueName: ctx.venue.name, seasonName: ctx.name, startDate: toISODate(ctx.startDate)!, weekday: ctx.weekday, regularRounds: ctx.regularRounds, allowInterLeague: ctx.allowInterLeague, excludedDates: ctx.excludedDates };
  return <>
    <ConfigContext context="Configuración general" title={ctx.name} description="Revisa los datos del torneo y la programación base de la temporada seleccionada." />
    <Card className="p-4 sm:p-6"><GeneralForm key={`${ctx.id}:${JSON.stringify(values)}`} action={updateGeneralAction} v={values} /></Card>
  </>;
}
