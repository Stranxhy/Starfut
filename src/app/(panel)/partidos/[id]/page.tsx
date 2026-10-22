import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { getSeasonContext } from "@/server/season";
import { MATCH_INCLUDE } from "@/server/services/matches";
import { cancelMatchAction, updateMatchAction } from "@/server/actions/matches";
import { MatchForm } from "@/components/forms/MatchForm";
import { MatchActionsBar } from "@/components/forms/MatchActionsBar";
import { Alert, Badge, Card, CardHeader, Collapsible, LinkButton, PageHeader } from "@/components/ui/core";
import { ScoreText, StatusBadge, TypeBadge } from "@/components/match-ui";
import { AuditList } from "@/components/AuditList";
import { formatLong, formatShort, toISODate } from "@/lib/dates";
import { MATCH_TYPE, RESULT_TYPE } from "@/lib/labels";

export default async function PartidoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const m = await prisma.match.findUnique({
    where: { id },
    include: {
      ...MATCH_INCLUDE,
      scorers: { include: { player: { select: { id: true, fullName: true } } }, orderBy: { goals: "desc" } },
      replacesMatch: { include: { homeTeam: true, awayTeam: true } },
      replacements: { include: { homeTeam: true, awayTeam: true } },
      playoffTie: { include: { stage: true } },
      result: true,
    },
  });
  if (!m) notFound();
  const ctx = await getSeasonContext(m.seasonId);
  const [teams, referees] = await Promise.all([
    prisma.team.findMany({ where: { seasonId: m.seasonId }, orderBy: { name: "asc" }, include: { league: { select: { name: true } } } }),
    prisma.referee.findMany({ where: { OR: [{ active: true }, { id: m.refereeId ?? "" }] }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const locked = m.locked || !!m.round?.locked;
  const date = toISODate(m.date);
  const teamOpts = teams.map((t) => ({ id: t.id, name: t.name, leagueId: t.leagueId, leagueName: t.league.name, active: t.active }));
  const formCommon = {
    matchId: m.id,
    teams: teamOpts,
    slots: ctx.timeSlots.filter((t) => t.active || t.id === m.timeSlotId),
    fields: ctx.venue.fields.filter((f) => f.active || f.id === m.fieldId),
    referees,
    initial: {
      type: m.type,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      date,
      timeSlotId: m.timeSlotId,
      fieldId: m.fieldId,
      refereeId: m.refereeId,
      countsForStandings: m.countsForStandings,
      notes: m.notes,
    },
  };

  return (
    <>
      <PageHeader
        breadcrumb={[{ href: "/partidos", label: "Partidos" }, ...(date ? [{ href: `/partidos?fecha=${date}`, label: formatShort(date) }] : [])]}
        title={`${m.homeTeam.name} vs ${m.awayTeam.name}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={m.status} />
            <TypeBadge type={m.type} counts={m.countsForStandings} />
            {locked && m.status !== "JUGADO" && <Badge className="bg-sky-100 text-sky-900 ring-sky-300">Calendario confirmado · protegido</Badge>}
            {m.league && <span>{m.league.name}</span>}
          </span>
        }
        actions={
          <>
            {m.status !== "CANCELADO" && m.status !== "PENDIENTE" && (
              <LinkButton href={`/resultados/${m.id}`}>{m.result ? "Corregir resultado" : "Registrar resultado"}</LinkButton>
            )}
            {date && (
              <LinkButton href={`/api/pdf/rol?date=${date}&league=${m.homeTeam.leagueId}`} target="_blank" variant="secondary">
                Rol del día
              </LinkButton>
            )}
          </>
        }
      />

      {m.status === "CANCELADO" && (
        <Alert tone="warn" className="mb-4" title="Partido cancelado">
          {m.cancelReason ?? "Sin motivo registrado."} No genera puntos: una derrota por incomparecencia solo procede con una decisión oficial (registra el resultado como decisión administrativa si así se resolvió).
        </Alert>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title="Detalle" />
          <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2 px-5 py-4 text-sm">
            <dt className="text-zinc-500">Fecha</dt>
            <dd className="font-semibold">{m.date ? formatLong(m.date) : "Sin fecha"}</dd>
            <dt className="text-zinc-500">Jornada / etapa</dt>
            <dd>{m.playoffTie ? `${m.playoffTie.stage.name} · cruce ${m.playoffTie.slot}` : m.round ? `Jornada ${m.round.number}` : "—"}</dd>
            <dt className="text-zinc-500">Horario</dt>
            <dd>{m.timeSlot?.startTime ?? "Sin asignar"}</dd>
            <dt className="text-zinc-500">Cancha</dt>
            <dd>{m.field?.name ?? "Sin asignar"}</dd>
            <dt className="text-zinc-500">Árbitro</dt>
            <dd className={m.referee ? "" : "font-semibold text-red-700"}>{m.referee?.name ?? "Sin asignar"}</dd>
            <dt className="text-zinc-500">Naturaleza</dt>
            <dd>
              {MATCH_TYPE[m.type]?.label} · {m.countsForStandings ? "cuenta para la clasificación" : "no altera la clasificación"}
            </dd>
            {m.originalDate && (
              <>
                <dt className="text-zinc-500">Fecha original</dt>
                <dd>
                  {formatShort(m.originalDate)} · {m.rescheduleCount} reprogramación(es)
                </dd>
              </>
            )}
            {m.notes && (
              <>
                <dt className="text-zinc-500">Observaciones</dt>
                <dd className="whitespace-pre-wrap">{m.notes}</dd>
              </>
            )}
            {m.replacesMatch && (
              <>
                <dt className="text-zinc-500">Sustituye a</dt>
                <dd>
                  <Link href={`/partidos/${m.replacesMatch.id}`} className="text-brand-700 hover:underline">
                    {m.replacesMatch.homeTeam.name} vs {m.replacesMatch.awayTeam.name} (cancelado)
                  </Link>
                </dd>
              </>
            )}
            {m.replacements.length > 0 && (
              <>
                <dt className="text-zinc-500">Sustituido por</dt>
                <dd className="space-y-0.5">
                  {m.replacements.map((r) => (
                    <Link key={r.id} href={`/partidos/${r.id}`} className="block text-brand-700 hover:underline">
                      {r.homeTeam.name} vs {r.awayTeam.name} ({MATCH_TYPE[r.type]?.short})
                    </Link>
                  ))}
                </dd>
              </>
            )}
          </dl>
          {m.result && (
            <div className="border-t border-zinc-100 px-5 py-4">
              <p className="text-xs font-bold tracking-wide text-zinc-500 uppercase">Resultado oficial · {RESULT_TYPE[m.result.resultType]}</p>
              <p className="mt-1 text-2xl">
                <ScoreText result={m.result} homeTeamId={m.homeTeamId} />
              </p>
              {m.result.notes && <p className="mt-1 text-sm text-zinc-600">{m.result.notes}</p>}
              {m.scorers.length > 0 ? (
                <ul className="mt-2 text-sm">
                  {m.scorers.map((s) => (
                    <li key={s.id}>
                      <Link href={`/jugadores/${s.player.id}`} className="font-semibold hover:underline">
                        {s.player.fullName}
                      </Link>{" "}
                      ({s.teamId === m.homeTeamId ? m.homeTeam.name : m.awayTeam.name}) · {s.goals} gol(es)
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">Sin goleadores individuales registrados.</p>
              )}
            </div>
          )}
          <div className="border-t border-zinc-100 px-5 py-4">
            <MatchActionsBar
              matchId={m.id}
              status={m.status}
              hasResult={!!m.result}
              isPlayoff={!!m.playoffTie}
              cancelAction={cancelMatchAction}
              reschedule={
                m.status !== "JUGADO"
                  ? { action: updateMatchAction, ...formCommon }
                  : undefined
              }
            />
          </div>
        </Card>

        {m.status !== "CANCELADO" ? (
          <Card>
            <CardHeader
              title="Editar partido"
              description={
                locked
                  ? "Calendario confirmado: indica el motivo del cambio."
                  : m.result
                    ? "El partido tiene resultado: no se pueden cambiar contrincantes ni tipo sin revertir el resultado."
                    : "Los cambios se validan antes de guardarse."
              }
            />
            <div className="px-4 py-4 sm:px-5">
              <MatchForm action={updateMatchAction} mode="edit" {...formCommon} requireReason={locked || !!m.result} teamsEditable={!m.result && !m.playoffTie} />
            </div>
          </Card>
        ) : (
          <Card>
            <CardHeader title="Opciones para el espacio cancelado" />
            <div className="space-y-3 px-5 py-4 text-sm text-zinc-700">
              <p>Puedes aprovechar el horario y la cancha con un partido de sustitución, un amistoso o un partido extraordinario entre ligas, o reprogramar este encuentro.</p>
              <div className="flex flex-wrap gap-2">
                <LinkButton href={`/partidos/nuevo?sustituye=${m.id}`}>Crear partido en este espacio</LinkButton>
                {date && (
                  <LinkButton href={`/partidos/completar?fecha=${date}`} variant="secondary">
                    Completar jornada (combinar equipos sin partido)
                  </LinkButton>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>

      <Collapsible title="Historial del partido" className="mt-5">
        <AuditList entity="Partido" entityId={m.id} />
      </Collapsible>
    </>
  );
}
