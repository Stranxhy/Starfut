import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { createLeagueAction, setLeagueActiveAction, updateLeagueAction } from "@/server/actions/teams";
import { LeagueFormButton, SimpleToggleForm } from "@/components/forms/entity-forms";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Table, TD, TH } from "@/components/ui/core";

export const metadata = { title: "Ligas" };

export default async function LigasPage() {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Sin temporada" />;
  const leagues = await prisma.league.findMany({
    where: { seasonId: ctx.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      championTeam: { select: { name: true } },
      _count: { select: { teams: { where: { active: true } } } },
      standingSnapshots: { select: { id: true } },
    },
  });
  const played = await prisma.match.groupBy({ by: ["leagueId"], where: { seasonId: ctx.id, status: "JUGADO" }, _count: true });
  return (
    <>
      <PageHeader
        title="Ligas"
        actions={<LeagueFormButton action={createLeagueAction} />}
      />
      <Card>
        {leagues.length === 0 ? (
          <EmptyState title="Sin ligas" description="Crea la primera liga de la temporada." />
        ) : (
          <Table>
            <thead>
              <tr>
                <TH>Liga</TH>
                <TH className="text-center">Equipos activos</TH>
                <TH className="text-center">Partidos disputados</TH>
                <TH>Fase</TH>
                <TH>Estado</TH>
                <TH className="text-right">Acciones</TH>
              </tr>
            </thead>
            <tbody>
              {leagues.map((l) => (
                <tr key={l.id}>
                  <TD className="font-semibold">
                    <Link href={`/ligas/${l.id}`} className="hover:text-brand-700 hover:underline">
                      {l.name}
                    </Link>
                  </TD>
                  <TD className="text-center tabular-nums">{l._count.teams}</TD>
                  <TD className="text-center tabular-nums">{played.find((p) => p.leagueId === l.id)?._count ?? 0}</TD>
                  <TD>
                    {l.championTeam ? (
                      <Badge className="bg-amber-100 text-amber-900 ring-amber-300">Campeón: {l.championTeam.name}</Badge>
                    ) : l.standingSnapshots.length ? (
                      <Badge className="bg-violet-100 text-violet-900 ring-violet-300">Eliminatorias</Badge>
                    ) : (
                      <Badge>Fase regular</Badge>
                    )}
                  </TD>
                  <TD>
                    {l.active ? <Badge className="bg-emerald-100 text-emerald-900 ring-emerald-300">Activa</Badge> : <Badge>Inactiva</Badge>}
                  </TD>
                  <TD>
                    <div className="flex flex-wrap justify-end gap-2">
                      <LinkButton href={`/ligas/${l.id}`} size="sm" variant="secondary">
                        Ver
                      </LinkButton>
                      <LeagueFormButton action={updateLeagueAction} league={l} />
                      <SimpleToggleForm
                        action={setLeagueActiveAction}
                        hidden={{ id: l.id, active: l.active ? "0" : "1" }}
                        label={l.active ? "Desactivar" : "Activar"}
                        variant={l.active ? "danger" : "secondary"}
                      />
                    </div>
                  </TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
