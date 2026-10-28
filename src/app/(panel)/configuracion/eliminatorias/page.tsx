import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { savePlayoffFormatAction } from "@/server/actions/config";
import { parseBracket, parseZones } from "@/server/services/rules";
import { BracketEditor } from "@/components/forms/config-forms";
import { Card, CardHeader, EmptyState, LinkButton } from "@/components/ui/core";
import { str, type SP } from "@/lib/params";
import { LeagueTabs } from "@/components/ui/filters";
import { ConfigContext } from "@/components/config/ConfigContext";

export const metadata = { title: "Eliminatorias y zonas" };

export default async function ConfigEliminatoriasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx || ctx.leagues.length === 0) return <EmptyState title="Registra una liga para preparar su cuadro" description="Cada liga puede tener sus propias etapas, cruces y zonas de clasificación." action={<LinkButton href={ctx ? "/ligas" : "/configuracion/temporadas"}>{ctx ? "Ir a Ligas" : "Crear temporada"}</LinkButton>} />;
  const sp = await searchParams;
  const league = ctx.leagues.find((l) => l.id === str(sp.liga)) ?? ctx.leagues[0];
  const [format, teamCount, closed] = await Promise.all([
    prisma.playoffFormat.findUnique({ where: { leagueId: league.id } }),
    prisma.team.count({ where: { leagueId: league.id, active: true } }),
    prisma.standingSnapshot.count({ where: { leagueId: league.id } }),
  ]);
  return (
    <>
      <ConfigContext context={ctx.name} title="Eliminatorias y zonas" description="Define los cruces de cada etapa y cómo se identifican las posiciones de la tabla general. Confirma el formato cuando corresponda al cuadro oficial." />
      <LeagueTabs path="/configuracion/eliminatorias" leagues={ctx.leagues} selected={league.id} />
      <Card>
        <CardHeader title={`Cuadro de ${league.name}`} description={`${teamCount} equipos activos.${closed ? " La fase regular ya está cerrada: el cuadro está bloqueado." : ""}`} />
        <div className="px-4 py-5 sm:px-5">
          <BracketEditor
            key={`${league.id}:${JSON.stringify(format)}:${closed}`}
            action={savePlayoffFormatAction}
            leagueId={league.id}
            initial={parseBracket(format?.stages)}
            initialZones={parseZones(format?.zones) ?? []}
            teamCount={teamCount}
            officialConfirmed={format?.officialConfirmed ?? false}
            locked={closed > 0}
          />
        </div>
      </Card>
    </>
  );
}
