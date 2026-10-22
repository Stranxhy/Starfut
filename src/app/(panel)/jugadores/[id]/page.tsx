import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { setPlayerActiveAction, transferPlayerAction, updatePlayerAction } from "@/server/actions/people";
import { PlayerEditForm, SimpleToggleForm, TransferPlayerButton } from "@/components/forms/entity-forms";
import { Badge, Card, CardHeader, Collapsible, EmptyState, PageHeader, StatCard, Table, TD, TH } from "@/components/ui/core";
import { TypeBadge } from "@/components/match-ui";
import { AuditList } from "@/components/AuditList";
import { formatShort } from "@/lib/dates";
import { SANCTION_STATUS } from "@/lib/labels";

export default async function JugadorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const player = await prisma.player.findUnique({
    where: { id },
    include: {
      team: { include: { league: true } },
      history: { include: { team: { select: { id: true, name: true } } }, orderBy: { fromDate: "asc" } },
      goals: {
        include: {
          team: { select: { name: true } },
          match: { include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } }, round: { select: { number: true } } } },
        },
      },
      sanctions: { include: { type: true, unit: true, _count: { select: { servings: true } } }, orderBy: { date: "desc" } },
    },
  });
  if (!player) notFound();
  const teams = await prisma.team.findMany({
    where: { seasonId: player.seasonId, active: true, id: { not: player.teamId } },
    orderBy: { name: "asc" },
    include: { league: { select: { name: true } } },
  });
  const goals = player.goals
    .filter((g) => g.match.status === "JUGADO")
    .sort((a, b) => (a.match.date?.getTime() ?? 0) - (b.match.date?.getTime() ?? 0));
  const official = goals.filter((g) => g.match.type !== "AMISTOSO").reduce((s, g) => s + g.goals, 0);
  const friendly = goals.filter((g) => g.match.type === "AMISTOSO").reduce((s, g) => s + g.goals, 0);

  return (
    <>
      <PageHeader
        breadcrumb={[{ href: "/jugadores", label: "Jugadores" }]}
        title={
          <span className="flex items-center gap-2">
            {player.fullName}
            {player.jerseyNumber != null && <span className="text-zinc-400">#{player.jerseyNumber}</span>}
            {!player.active && <Badge>Inactivo</Badge>}
          </span>
        }
        description={
          <>
            <Link className="font-semibold hover:underline" href={`/equipos/${player.teamId}`}>{player.team.name}</Link> · {player.team.league.name}
          </>
        }
        actions={
          <>
            <TransferPlayerButton action={transferPlayerAction} playerId={player.id} teams={teams.map((t) => ({ value: t.id, label: `${t.name} (${t.league.name})` }))} />
            <SimpleToggleForm action={setPlayerActiveAction} hidden={{ id: player.id, active: player.active ? "0" : "1" }} label={player.active ? "Desactivar" : "Activar"} variant={player.active ? "danger" : "secondary"} />
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Goles oficiales" value={official} />
        <StatCard label="Partidos con gol" value={new Set(goals.filter((g) => g.match.type !== "AMISTOSO").map((g) => g.matchId)).size} />
        <StatCard label="Goles en amistosos" value={friendly} hint="No cuentan para el goleo" />
        <StatCard label="Sanciones" value={player.sanctions.length} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Historial de goles" description="Detalle por partido" />
          {goals.length === 0 ? (
            <EmptyState title="Sin goles registrados" />
          ) : (
            <Table>
              <thead><tr><TH>Fecha</TH><TH>Partido</TH><TH>Equipo</TH><TH className="text-center">Goles</TH></tr></thead>
              <tbody>
                {goals.map((g) => (
                  <tr key={g.id}>
                    <TD>{formatShort(g.match.date)}{g.match.round && <span className="block text-xs text-zinc-500">J{g.match.round.number}</span>}</TD>
                    <TD><Link href={`/partidos/${g.matchId}`} className="hover:underline">{g.match.homeTeam.name} vs {g.match.awayTeam.name}</Link> <TypeBadge type={g.match.type} counts={g.match.countsForStandings} /></TD>
                    <TD>{g.team.name}</TD>
                    <TD className="text-center font-bold">{g.goals}</TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader title="Historial de sanciones" />
          {player.sanctions.length === 0 ? (
            <EmptyState title="Sin sanciones" />
          ) : (
            <Table>
              <thead><tr><TH>Fecha</TH><TH>Tipo</TH><TH>Duración</TH><TH>Estado</TH></tr></thead>
              <tbody>
                {player.sanctions.map((s) => (
                  <tr key={s.id}>
                    <TD><Link href={`/sanciones/${s.id}`} className="hover:underline">{formatShort(s.date)}</Link></TD>
                    <TD>{s.type.name}</TD>
                    <TD>{s.duration} {s.unit.name.toLowerCase()}{s.unit.kind === "PARTIDOS" && ` (${s._count.servings} cumplidos)`}</TD>
                    <TD><Badge className={SANCTION_STATUS[s.status].className}>{SANCTION_STATUS[s.status].label}</Badge></TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <div className="mt-5 space-y-3">
        <Collapsible title="Editar datos y trayectoria">
          <div className="px-4 py-4 sm:px-5">
            <PlayerEditForm action={updatePlayerAction} player={player} />
          </div>
          <div className="border-t border-zinc-100 px-4 py-3 sm:px-5">
            <ol className="space-y-1 text-sm">
              {player.history.map((h) => (
                <li key={h.id}>
                  <Link href={`/equipos/${h.team.id}`} className="font-semibold hover:underline">{h.team.name}</Link>{" "}
                  <span className="text-zinc-500">
                    desde {h.fromDate.toLocaleDateString("es-MX")}
                    {h.toDate ? ` hasta ${h.toDate.toLocaleDateString("es-MX")}` : " (actual)"}
                    {h.reason ? ` · ${h.reason}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </Collapsible>
        <Collapsible title="Historial de cambios">
          <AuditList entity="Jugador" entityId={player.id} />
        </Collapsible>
      </div>
    </>
  );
}
