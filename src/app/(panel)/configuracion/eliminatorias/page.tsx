import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { savePlayoffFormatAction } from "@/server/actions/config";
import { parseBracket, parseZones } from "@/server/services/rules";
import { BracketEditor } from "@/components/forms/config-forms";
import { Card, CardHeader, EmptyState } from "@/components/ui/core";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Eliminatorias y zonas" };

export default async function ConfigEliminatoriasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx || ctx.leagues.length === 0) return <EmptyState title="Sin ligas" />;
  const sp = await searchParams;
  const league = ctx.leagues.find((l) => l.id === str(sp.liga)) ?? ctx.leagues[0];
  const [format, teamCount, closed] = await Promise.all([
    prisma.playoffFormat.findUnique({ where: { leagueId: league.id } }),
    prisma.team.count({ where: { leagueId: league.id, active: true } }),
    prisma.standingSnapshot.count({ where: { leagueId: league.id } }),
  ]);
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {ctx.leagues.map((l) => (
          <Link key={l.id} href={`/configuracion/eliminatorias?liga=${l.id}`} className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${l.id === league.id ? "bg-brand-700 text-white ring-brand-700" : "bg-white ring-zinc-300"}`}>{l.name}</Link>
        ))}
      </div>
      <Card>
        <CardHeader title={`Cuadro de ${league.name}`} description={`${teamCount} equipos activos.${closed ? " La fase regular ya está cerrada: el cuadro está bloqueado." : ""}`} />
        <div className="px-4 py-5 sm:px-5">
          <BracketEditor
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
