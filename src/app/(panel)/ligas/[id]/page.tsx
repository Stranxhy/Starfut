import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { getLeagueStandings, getLeagueScorers } from "@/server/services/standings";
import { Badge, Card, CardHeader, LinkButton, PageHeader, StatCard, Table, TD, TH } from "@/components/ui/core";
import { formatShort, toISODate } from "@/lib/dates";

export default async function LigaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const league = await prisma.league.findUnique({ where: { id }, include: { season: true, championTeam: true } });
  if (!league) notFound();
  const [standings, scorers, rounds, teams, goals] = await Promise.all([
    getLeagueStandings(id),
    getLeagueScorers(id),
    prisma.round.findMany({
      where: { seasonId: league.seasonId },
      orderBy: [{ phase: "asc" }, { number: "asc" }],
      include: { matches: { where: { leagueId: id }, select: { status: true } } },
    }),
    prisma.team.findMany({ where: { leagueId: id }, orderBy: { name: "asc" }, include: { _count: { select: { players: true } } } }),
    prisma.matchResult.aggregate({
      where: { match: { leagueId: id, status: "JUGADO" } },
      _sum: { homeGoals: true, awayGoals: true },
      _count: true,
    }),
  ]);
  const totalGoals = (goals._sum.homeGoals ?? 0) + (goals._sum.awayGoals ?? 0);
  return (
    <>
      <PageHeader
        breadcrumb={[{ href: "/ligas", label: "Ligas" }]}
        title={league.name}
        description={`${league.season.name}${league.championTeam ? ` · Campeón: ${league.championTeam.name}` : ""}`}
        actions={
          <>
            <LinkButton href={`/tabla?liga=${id}`} variant="secondary">
              Tabla general
            </LinkButton>
            <LinkButton href={`/goleo?liga=${id}`} variant="secondary">
              Goleo
            </LinkButton>
            <LinkButton href={`/eliminatorias?liga=${id}`} variant="secondary">
              Eliminatorias
            </LinkButton>
            <LinkButton href={`/configuracion/reglas?liga=${id}`} variant="secondary">
              Reglas
            </LinkButton>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Equipos activos" value={teams.filter((t) => t.active).length} hint={`${teams.length} registrados`} />
        <StatCard label="Partidos disputados" value={goals._count} />
        <StatCard
          label="Goles (tiempo regular)"
          value={totalGoals}
          hint={goals._count ? `${(totalGoals / goals._count).toFixed(2)} por partido` : undefined}
        />
        <StatCard
          label="Líder"
          value={standings.rows[0]?.jj ? standings.rows[0].teamName : "—"}
          hint={scorers.rows[0] ? `Goleador: ${scorers.rows[0].playerName} (${scorers.rows[0].goals})` : undefined}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader
            title="Jornadas"
            description="Partidos de esta liga por jornada"
            actions={
              <LinkButton href="/calendario" size="sm" variant="ghost">
                Calendario
              </LinkButton>
            }
          />
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <thead>
                <tr>
                  <TH>Jornada</TH>
                  <TH>Fecha</TH>
                  <TH className="text-center">Partidos</TH>
                  <TH className="text-center">Disputados</TH>
                </tr>
              </thead>
              <tbody>
                {rounds
                  .filter((r) => r.matches.length)
                  .map((r) => (
                    <tr key={r.id}>
                      <TD>
                        <Link
                          className="font-semibold hover:text-brand-700 hover:underline"
                          href={`/partidos?liga=${id}&fecha=${toISODate(r.date)}`}
                        >
                          {r.phase === "REGULAR" ? `Jornada ${r.number}` : r.name}
                        </Link>
                      </TD>
                      <TD>{formatShort(r.date)}</TD>
                      <TD className="text-center">{r.matches.filter((m) => m.status !== "CANCELADO").length}</TD>
                      <TD className="text-center">{r.matches.filter((m) => m.status === "JUGADO").length}</TD>
                    </tr>
                  ))}
              </tbody>
            </Table>
          </div>
        </Card>
        <Card>
        <CardHeader
          title="Equipos"
          actions={
            <LinkButton href={`/equipos?liga=${id}`} size="sm" variant="ghost">
              Administrar
            </LinkButton>
          }
        />
        <Table>
          <thead>
            <tr>
              <TH>Equipo</TH>
              <TH className="text-center">Jugadores</TH>
              <TH className="text-center">Posición</TH>
              <TH>Estado</TH>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id}>
                <TD className="font-semibold">
                  <Link href={`/equipos/${t.id}`} className="hover:text-brand-700 hover:underline">
                    {t.name}
                  </Link>
                </TD>
                <TD className="text-center">{t._count.players}</TD>
                <TD className="text-center">{standings.rows.find((r) => r.teamId === t.id)?.position ?? "—"}</TD>
                <TD>
                  {t.active ? <Badge className="bg-emerald-100 text-emerald-900 ring-emerald-300">Activo</Badge> : <Badge>Baja</Badge>}
                </TD>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      </div>
    </>
  );
}
