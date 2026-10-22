import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { createSeasonAction, setCurrentSeasonAction, setSeasonStatusAction } from "@/server/actions/config";
import { SeasonCreateButton } from "@/components/forms/config-forms";
import { SimpleToggleForm } from "@/components/forms/entity-forms";
import { Badge, Card, CardHeader, Table, TD, TH } from "@/components/ui/core";
import { formatShort } from "@/lib/dates";
import { SEASON_STATUS } from "@/lib/labels";

export const metadata = { title: "Temporadas" };

export default async function TemporadasPage() {
  await requireUser();
  const seasons = await prisma.season.findMany({
    orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
    include: { _count: { select: { leagues: true, teams: true, matches: true } }, leagues: { include: { championTeam: { select: { name: true } } } } },
  });
  return (
    <Card>
      <CardHeader
        title="Temporadas y torneos"
        description="Cada temporada conserva su propia configuración, calendario, clasificación y estadísticas. Usa el selector superior para consultar el historial."
        actions={<SeasonCreateButton action={createSeasonAction} seasons={seasons.map((s) => ({ value: s.id, label: s.name }))} />}
      />
      <Table>
        <thead><tr><TH>Temporada</TH><TH>Inicio</TH><TH className="text-center">Ligas</TH><TH className="text-center">Equipos</TH><TH className="text-center">Partidos</TH><TH>Campeones</TH><TH>Estado</TH><TH className="text-right">Acciones</TH></tr></thead>
        <tbody>
          {seasons.map((s) => (
            <tr key={s.id}>
              <TD className="font-semibold">
                {s.name}
                {s.isCurrent && <Badge className="ml-2 bg-emerald-100 text-emerald-900 ring-emerald-300">Vigente</Badge>}
                {s.isDemo && <Badge className="ml-2 bg-amber-100 text-amber-900 ring-amber-300">Demo</Badge>}
              </TD>
              <TD>{formatShort(s.startDate)}</TD>
              <TD className="text-center">{s._count.leagues}</TD>
              <TD className="text-center">{s._count.teams}</TD>
              <TD className="text-center">{s._count.matches}</TD>
              <TD className="text-xs">{s.leagues.filter((l) => l.championTeam).map((l) => `${l.name}: ${l.championTeam!.name}`).join(" · ") || "—"}</TD>
              <TD><Badge>{SEASON_STATUS[s.status]}</Badge></TD>
              <TD>
                <div className="flex flex-wrap justify-end gap-2">
                  {!s.isCurrent && <SimpleToggleForm action={setCurrentSeasonAction} hidden={{ id: s.id }} label="Marcar vigente" />}
                  {s.status !== "FINALIZADA" ? (
                    <SimpleToggleForm action={setSeasonStatusAction} hidden={{ id: s.id, status: "FINALIZADA" }} label="Finalizar" variant="danger" />
                  ) : (
                    <SimpleToggleForm action={setSeasonStatusAction} hidden={{ id: s.id, status: "EN_CURSO" }} label="Reabrir" />
                  )}
                </div>
              </TD>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
