import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { getLeagueStandings } from "@/server/services/standings";
import { MATCH_INCLUDE, sortMatches } from "@/server/services/matches";
import {
  addTeamRestrictionAction,
  deleteTeamRestrictionAction,
  setTeamActiveAction,
  updateTeamAction,
  uploadTeamLogoAction,
} from "@/server/actions/teams";
import { createPlayerAction } from "@/server/actions/people";
import { DeactivateTeamButton, LogoForm, PlayerCreateButton, SimpleToggleForm, TeamEditForm } from "@/components/forms/entity-forms";
import { RestrictionForm } from "@/components/forms/RestrictionForm";
import { Alert, Badge, Card, CardHeader, Collapsible, EmptyState, LinkButton, PageHeader, StatCard, Table, TD, TH } from "@/components/ui/core";
import { ScoreText, StatusBadge, TeamLink, TypeBadge } from "@/components/match-ui";
import { AuditList } from "@/components/AuditList";
import { formatShort } from "@/lib/dates";

export default async function EquipoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      league: true,
      season: { include: { leagues: true, timeSlots: { orderBy: { startTime: "asc" } } } },
      players: { orderBy: [{ active: "desc" }, { fullName: "asc" }], include: { _count: { select: { goals: true } } } },
      restrictions: { include: { timeSlot: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!team) notFound();
  const [standings, matches, goalsByPlayer, sanctions] = await Promise.all([
    getLeagueStandings(team.leagueId),
    prisma.match.findMany({ where: { OR: [{ homeTeamId: id }, { awayTeamId: id }] }, include: MATCH_INCLUDE }),
    prisma.matchScorer.groupBy({ by: ["playerId"], where: { teamId: id, match: { status: "JUGADO", type: { not: "AMISTOSO" } } }, _sum: { goals: true } }),
    prisma.sanction.count({ where: { teamId: id, status: { in: ["ACTIVA", "PENDIENTE", "EN_REVISION"] } } }),
  ]);
  const row = standings.rows.find((r) => r.teamId === id);
  const sorted = sortMatches(matches);
  const played = sorted.filter((m) => m.status === "JUGADO");
  const upcoming = sorted.filter((m) => m.status !== "JUGADO" && m.status !== "CANCELADO");
  const goalsMap = new Map(goalsByPlayer.map((g) => [g.playerId, g._sum.goals ?? 0]));
  const leagueOpts = team.season.leagues.map((l) => ({ value: l.id, label: l.name }));

  return (
    <>
      <PageHeader
        breadcrumb={[{ href: "/equipos", label: "Equipos" }]}
        title={
          <span className="flex items-center gap-3">
            {team.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/escudo/${team.id}`} alt="" className="h-10 w-10 rounded object-contain ring-1 ring-zinc-200" />
            )}
            {team.name}
            {!team.active && <Badge>Baja</Badge>}
            {team.isDemo && <Badge className="bg-amber-100 text-amber-900 ring-amber-300">Demo</Badge>}
          </span>
        }
        description={`${team.league.name} · ${team.season.name}`}
        actions={
          <>
            <LinkButton href={`/api/pdf/estadisticas-equipo?team=${id}`} target="_blank" variant="secondary">
              PDF estadísticas
            </LinkButton>
            <DeactivateTeamButton action={setTeamActiveAction} teamId={id} active={team.active} />
          </>
        }
      />
      {!team.active && (
        <Alert tone="warn" className="mb-4" title="Equipo dado de baja">
          Su historial se conserva. {upcoming.length > 0 && `Aún tiene ${upcoming.length} partido(s) pendientes en el calendario: revísalos.`}
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Posición" value={row?.position ?? "—"} hint={`${row?.pts ?? 0} puntos`} href={`/tabla?liga=${team.leagueId}`} />
        <StatCard label="Partidos" value={row?.jj ?? 0} hint={`JG ${row?.jg ?? 0} · JP ${row?.jp ?? 0} · EG ${row?.eg ?? 0} · EP ${row?.ep ?? 0}`} />
        <StatCard label="Goles" value={`${row?.gf ?? 0} - ${row?.ge ?? 0}`} hint={`Diferencia ${row?.dif ?? 0}`} />
        <StatCard label="Sanciones vigentes" value={sanctions} tone={sanctions ? "warn" : "default"} href={`/sanciones?equipo=${id}`} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Calendario del equipo" description={`${upcoming.length} partido(s) pendientes`} />
          {upcoming.length === 0 ? (
            <EmptyState title="Sin partidos pendientes" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <TH>Fecha</TH>
                  <TH>Hora</TH>
                  <TH>Cancha</TH>
                  <TH>Rival</TH>
                  <TH>Estado</TH>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((m) => {
                  const rival = m.homeTeamId === id ? m.awayTeam : m.homeTeam;
                  return (
                    <tr key={m.id}>
                      <TD>
                        <Link href={`/partidos/${m.id}`} className="font-semibold hover:text-brand-700 hover:underline">
                          {formatShort(m.date)}
                        </Link>
                      </TD>
                      <TD>{m.timeSlot?.startTime ?? "—"}</TD>
                      <TD>{m.field?.name ?? "—"}</TD>
                      <TD>
                        <TeamLink id={rival.id} name={rival.name} /> <TypeBadge type={m.type} counts={m.countsForStandings} />
                      </TD>
                      <TD>
                        <StatusBadge status={m.status} />
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader title="Historial de partidos" description={`${played.length} disputado(s)`} />
          {played.length === 0 ? (
            <EmptyState title="Sin partidos disputados" />
          ) : (
            <div className="max-h-[28rem] overflow-y-auto">
              <Table>
                <thead>
                  <tr>
                    <TH>Fecha</TH>
                    <TH>Local</TH>
                    <TH className="text-center">Marcador</TH>
                    <TH>Visitante</TH>
                  </tr>
                </thead>
                <tbody>
                  {[...played].reverse().map((m) => (
                    <tr key={m.id}>
                      <TD>
                        <Link href={`/partidos/${m.id}`} className="hover:text-brand-700 hover:underline">
                          {formatShort(m.date)}
                        </Link>
                        <div>
                          <TypeBadge type={m.type} counts={m.countsForStandings} />
                        </div>
                      </TD>
                      <TD>
                        <TeamLink id={m.homeTeam.id} name={m.homeTeam.name} winner={m.result?.winnerTeamId === m.homeTeamId} />
                      </TD>
                      <TD className="text-center">
                        <ScoreText result={m.result} homeTeamId={m.homeTeamId} />
                      </TD>
                      <TD>
                        <TeamLink id={m.awayTeam.id} name={m.awayTeam.name} winner={m.result?.winnerTeamId === m.awayTeamId} />
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          title="Jugadores"
          actions={
            <PlayerCreateButton
              action={createPlayerAction}
              teams={[{ value: team.id, label: team.name }]}
              defaultTeamId={team.id}
            />
          }
        />
        {team.players.length === 0 ? (
          <EmptyState title="Sin jugadores registrados" />
        ) : (
          <Table>
            <thead>
              <tr>
                <TH className="w-16 text-center">#</TH>
                <TH>Jugador</TH>
                <TH className="text-center">Goles</TH>
                <TH>Estado</TH>
              </tr>
            </thead>
            <tbody>
              {team.players.map((p) => (
                <tr key={p.id}>
                  <TD className="text-center text-zinc-500 tabular-nums">{p.jerseyNumber ?? "—"}</TD>
                  <TD className="font-semibold">
                    <Link href={`/jugadores/${p.id}`} className="hover:text-brand-700 hover:underline">
                      {p.fullName}
                    </Link>
                  </TD>
                  <TD className="text-center tabular-nums">{goalsMap.get(p.id) ?? 0}</TD>
                  <TD>{p.active ? <Badge className="bg-emerald-100 text-emerald-900 ring-emerald-300">Activo</Badge> : <Badge>Inactivo</Badge>}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="mt-5 space-y-3">
        <Collapsible title="Editar datos del equipo">
          <div className="space-y-5 px-4 py-4 sm:px-5">
            <TeamEditForm
              action={updateTeamAction}
              leagues={leagueOpts}
              team={{
                id: team.id,
                name: team.name,
                leagueId: team.leagueId,
                contactName: team.contactName,
                contactPhone: team.contactPhone,
                contactEmail: team.contactEmail,
                notes: team.notes,
              }}
            />
            <LogoForm action={uploadTeamLogoAction} teamId={team.id} hasLogo={!!team.logo} />
          </div>
        </Collapsible>
        <Collapsible title={`Restricciones de disponibilidad (${team.restrictions.length})`}>
          <div className="px-4 py-4 sm:px-5">
            <RestrictionForm action={addTeamRestrictionAction} teamId={team.id} slots={team.season.timeSlots.map((t) => ({ value: t.id, label: t.startTime }))} />
          </div>
          {team.restrictions.length > 0 && (
            <Table>
              <thead>
                <tr>
                  <TH>Fecha</TH>
                  <TH>Horario</TH>
                  <TH>Motivo</TH>
                  <TH />
                </tr>
              </thead>
              <tbody>
                {team.restrictions.map((r) => (
                  <tr key={r.id}>
                    <TD>{r.date ? formatShort(r.date) : "Todas las fechas"}</TD>
                    <TD>{r.timeSlot?.startTime ?? "Todo el día"}</TD>
                    <TD className="text-zinc-600">{r.reason ?? "—"}</TD>
                    <TD className="text-right">
                      <SimpleToggleForm action={deleteTeamRestrictionAction} hidden={{ id: r.id }} label="Eliminar" variant="danger" />
                    </TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Collapsible>

        <Collapsible title="Historial de cambios">
          <AuditList entity="Equipo" entityId={team.id} />
        </Collapsible>
      </div>
    </>
  );
}
