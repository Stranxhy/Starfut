import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { firstEditableRound, getActiveDraft, suggestedDates } from "@/server/services/schedule";
import {
  confirmDraftAction,
  discardDraftAction,
  generateDraftAction,
  regenerateDraftAction,
  setRoundLockAction,
  updateRoundDateAction,
} from "@/server/actions/schedule";
import { DraftActions, GeneratorForm, RoundAdminButtons } from "@/components/forms/schedule-forms";
import { Alert, Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, StatCard, Table, TD, TH } from "@/components/ui/core";
import { formatLong, formatShort, toISODate } from "@/lib/dates";
import { int, type SP } from "@/lib/params";

export const metadata = { title: "Calendario y jornadas" };

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Sin temporada" />;
  const sp = await searchParams;
  const minRound = await firstEditableRound(ctx.id);
  const fromRound = Math.max(minRound, int(sp.desde, minRound));
  const canGenerate = fromRound <= ctx.regularRounds;
  const [dates, draft, rounds, leagues] = await Promise.all([
    canGenerate ? suggestedDates(ctx.id, fromRound) : Promise.resolve([]),
    getActiveDraft(ctx.id),
    prisma.round.findMany({
      where: { seasonId: ctx.id },
      orderBy: [{ phase: "asc" }, { number: "asc" }],
      include: { matches: { select: { status: true, refereeId: true, timeSlotId: true } } },
    }),
    prisma.league.findMany({
      where: { seasonId: ctx.id, active: true },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { teams: { where: { active: true } } } } },
    }),
  ]);

  // Nombres para la vista previa
  const [teams, referees] = draft
    ? await Promise.all([
        prisma.team.findMany({ where: { seasonId: ctx.id }, select: { id: true, name: true } }),
        prisma.referee.findMany({ select: { id: true, name: true } }),
      ])
    : [[], []];
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const refName = new Map(referees.map((r) => [r.id, r.name]));
  const slotLabel = new Map(ctx.timeSlots.map((t) => [t.id, t.startTime]));
  const fieldName = new Map(ctx.venue.fields.map((f) => [f.id, f.name]));
  const leagueName = new Map(ctx.leagues.map((l) => [l.id, l.name]));
  const activeSlots = ctx.timeSlots.filter((t) => t.active);

  return (
    <>
      <PageHeader
        title="Calendario y jornadas"
        description={`${ctx.regularRounds} jornadas de fase regular · ${activeSlots.length} horarios · ${ctx.venue.fields.filter((f) => f.active).length} canchas · día de juego: ${["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][ctx.weekday]}`}
        actions={
          <>
            <LinkButton href="/api/pdf/calendario" target="_blank" variant="secondary">PDF calendario completo</LinkButton>
            <LinkButton href="/configuracion" variant="ghost">Configurar</LinkButton>
          </>
        }
      />

      {!draft && (
        <Card className="mb-5">
          <CardHeader
            title="Programación automática"
            actions={
              canGenerate && minRound < ctx.regularRounds ? (
                <form className="flex items-center gap-2 text-xs">
                  <label htmlFor="desde" className="font-semibold text-zinc-600">Generar desde la jornada</label>
                  <select id="desde" name="desde" defaultValue={fromRound} className="rounded-md py-1 ring-1 ring-zinc-300">
                    {Array.from({ length: ctx.regularRounds - minRound + 1 }, (_, i) => minRound + i).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <button className="rounded-md bg-zinc-900 px-2 py-1 font-semibold text-white">Aplicar</button>
                </form>
              ) : undefined
            }
          />
          <div className="px-4 py-4 sm:px-5">
            {canGenerate ? (
              <>
                {minRound > 1 && (
                  <Alert tone="info" className="mb-4">
                    Las jornadas 1–{minRound - 1} están confirmadas o disputadas y se conservan. El generador evitará repetir sus enfrentamientos.
                  </Alert>
                )}
                <GeneratorForm
                  action={generateDraftAction}
                  fromRound={fromRound}
                  dates={dates}
                  leagues={leagues.map((l) => ({ id: l.id, name: l.name, teams: l._count.teams }))}
                />
              </>
            ) : (
              <Alert tone="ok" title="Fase regular programada">
                Todas las jornadas están confirmadas. Para modificar una jornada, desbloquéala en la lista inferior.
              </Alert>
            )}
          </div>
        </Card>
      )}

      {draft && (
        <Card className="mb-5 ring-2 ring-brand-300">
          <CardHeader
            title="Vista previa del calendario (provisional)"
            description={`Jornadas ${draft.params.fromRound}–${draft.params.fromRound + draft.params.dates.length - 1} · semilla ${draft.data.summary.seed} · generado ${draft.createdAt.toLocaleString("es-MX")}`}
            actions={<DraftActions draftId={draft.id} confirm={confirmDraftAction} discard={discardDraftAction} regenerate={regenerateDraftAction} />}
          />
          <div className="space-y-4 px-4 py-4 sm:px-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatCard label="Partidos" value={draft.data.summary.totalMatches} />
              <StatCard label="Enfrentamientos repetidos" value={draft.data.summary.repeatedMatches} tone={draft.data.summary.repeatedMatches ? "warn" : "ok"} />
              <StatCard label="Con conflictos" value={draft.data.summary.conflicts} tone={draft.data.summary.conflicts ? "danger" : "ok"} />
              <StatCard label="Sin árbitro" value={draft.data.summary.matchesWithoutReferee} tone={draft.data.summary.matchesWithoutReferee ? "warn" : "ok"} />
              <StatCard label="Sin espacio" value={draft.data.summary.unscheduledMatches} tone={draft.data.summary.unscheduledMatches ? "danger" : "ok"} />
            </div>
            {draft.data.errors.map((e) => <Alert key={e} tone="danger">{e}</Alert>)}
            {draft.data.warnings.length > 0 && (
              <Alert tone="warn" title="Advertencias">
                <ul className="list-disc pl-5">{draft.data.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              </Alert>
            )}
            <Table>
              <thead>
                <tr><TH>Liga</TH><TH className="text-center">Equipos</TH><TH className="text-center">Enfrentamientos únicos posibles</TH><TH className="text-center">Jornadas sin repetir</TH><TH className="text-center">Repetidos</TH><TH>Verificación</TH></tr>
              </thead>
              <tbody>
                {draft.data.summary.leagues.map((l) => (
                  <tr key={l.leagueId}>
                    <TD className="font-semibold">{l.leagueName}</TD>
                    <TD className="text-center">{l.teams}</TD>
                    <TD className="text-center">{l.uniquePairs}</TD>
                    <TD className="text-center">{l.roundsWithoutRepeats}</TD>
                    <TD className="text-center">{l.repeatedMatches}</TD>
                    <TD>
                      {l.repeatedMatches === 0 ? (
                        <Badge className="bg-emerald-100 text-emerald-900 ring-emerald-300">Sin repeticiones (verificado)</Badge>
                      ) : l.repeatsUnavoidable ? (
                        <Badge className="bg-amber-100 text-amber-900 ring-amber-300">Repeticiones matemáticamente inevitables</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-900 ring-red-300">Repeticiones evitables: regenera</Badge>
                      )}
                    </TD>
                  </tr>
                ))}
              </tbody>
            </Table>

            <details className="rounded-lg ring-1 ring-zinc-200">
              <summary className="cursor-pointer px-4 py-2 text-sm font-semibold">Distribución de horarios por equipo y carga de árbitros</summary>
              <div className="grid gap-4 p-4 xl:grid-cols-[1fr_18rem]">
                <Table>
                  <thead>
                    <tr><TH>Equipo</TH>{activeSlots.map((s) => <TH key={s.id} className="text-center">{s.startTime}</TH>)}</tr>
                  </thead>
                  <tbody>
                    {Object.entries(draft.data.summary.slotDistribution)
                      .sort(([a], [b]) => (teamName.get(a) ?? "").localeCompare(teamName.get(b) ?? "", "es"))
                      .map(([teamId, dist]) => {
                        const max = Math.max(...Object.values(dist));
                        return (
                          <tr key={teamId}>
                            <TD className="font-medium">{teamName.get(teamId)}</TD>
                            {activeSlots.map((s) => (
                              <TD key={s.id} className={`text-center tabular-nums ${dist[s.id] && dist[s.id] === max && max >= 4 ? "font-bold text-amber-700" : ""}`}>{dist[s.id] ?? 0}</TD>
                            ))}
                          </tr>
                        );
                      })}
                  </tbody>
                </Table>
                <div>
                  <p className="mb-2 text-xs font-bold tracking-wide text-zinc-500 uppercase">Partidos por árbitro</p>
                  <ul className="space-y-1 text-sm">
                    {Object.entries(draft.data.summary.refereeLoad).sort((a, b) => b[1] - a[1]).map(([id, n]) => (
                      <li key={id} className="flex justify-between"><span>{refName.get(id)}</span><span className="font-bold tabular-nums">{n}</span></li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>

            <div className="space-y-3">
              {draft.data.rounds.map((r, idx) => (
                <details key={r.number} open={idx === 0} className="rounded-lg ring-1 ring-zinc-200">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-2 text-sm">
                    <span className="font-bold">Jornada {r.number}</span>
                    <span className="text-zinc-600">{formatLong(r.date)}</span>
                    <Badge>{r.matches.length} partidos</Badge>
                    <Badge>{r.unusedSlots} espacios libres de {r.availableSlots}</Badge>
                    {r.matches.some((m) => m.conflicts.length) && <Badge className="bg-red-100 text-red-900 ring-red-300">Conflictos</Badge>}
                    {r.matches.some((m) => m.repeatIndex > 0) && <Badge className="bg-amber-100 text-amber-900 ring-amber-300">Repeticiones</Badge>}
                  </summary>
                  <Table>
                    <thead>
                      <tr><TH>Horario</TH><TH>Cancha</TH><TH>Liga</TH><TH>Local</TH><TH /><TH>Visitante</TH><TH>Árbitro</TH><TH>Observaciones</TH></tr>
                    </thead>
                    <tbody>
                      {[...r.matches]
                        .sort((a, b) => (slotLabel.get(a.timeSlotId ?? "") ?? "99").localeCompare(slotLabel.get(b.timeSlotId ?? "") ?? "99") || (fieldName.get(a.fieldId ?? "") ?? "").localeCompare(fieldName.get(b.fieldId ?? "") ?? "", "es", { numeric: true }))
                        .map((m) => (
                          <tr key={m.key} className={m.conflicts.length ? "bg-red-50" : m.repeatIndex ? "bg-amber-50" : ""}>
                            <TD className="tabular-nums">{m.timeSlotId ? slotLabel.get(m.timeSlotId) : "—"}</TD>
                            <TD>{m.fieldId ? fieldName.get(m.fieldId) : "—"}</TD>
                            <TD className="text-zinc-600">{leagueName.get(m.leagueId)}</TD>
                            <TD className="font-semibold">{teamName.get(m.homeTeamId)}</TD>
                            <TD className="text-xs text-zinc-400">vs</TD>
                            <TD className="font-semibold">{teamName.get(m.awayTeamId)}</TD>
                            <TD>{m.refereeId ? refName.get(m.refereeId) : <span className="text-red-700">Sin asignar</span>}</TD>
                            <TD className="text-xs">
                              {m.repeatIndex > 0 && <span className="block text-amber-800">Repetición n.º {m.repeatIndex}</span>}
                              {m.conflicts.map((c) => <span key={c} className="block text-red-800">{c}</span>)}
                            </TD>
                          </tr>
                        ))}
                    </tbody>
                  </Table>
                  {r.byes.length > 0 && (
                    <p className="px-4 py-2 text-xs text-zinc-600">Descansan: {r.byes.map((b) => `${teamName.get(b.teamId)} (${leagueName.get(b.leagueId)})`).join(", ")}</p>
                  )}
                </details>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Jornadas" />
        {rounds.length === 0 ? (
          <EmptyState title="Sin jornadas" description="Genera y confirma el calendario para crear las jornadas." />
        ) : (
          <Table>
            <thead>
              <tr><TH>Jornada</TH><TH>Fecha</TH><TH className="text-center">Partidos</TH><TH className="text-center">Disputados</TH><TH className="text-center">Cancelados</TH><TH className="text-center">Sin árbitro</TH><TH>Estado</TH><TH className="text-right">Acciones</TH></tr>
            </thead>
            <tbody>
              {rounds.map((r) => {
                const active = r.matches.filter((m) => m.status !== "CANCELADO");
                const iso = toISODate(r.date)!;
                return (
                  <tr key={r.id}>
                    <TD className="font-semibold">
                      <Link href={`/partidos?fecha=${iso}`} className="hover:text-brand-700 hover:underline">
                        {r.phase === "REGULAR" ? `Jornada ${r.number}` : (r.name ?? `Eliminatoria ${r.number}`)}
                      </Link>
                    </TD>
                    <TD>{formatShort(r.date)}</TD>
                    <TD className="text-center tabular-nums">{active.length}</TD>
                    <TD className="text-center tabular-nums">{r.matches.filter((m) => m.status === "JUGADO").length}</TD>
                    <TD className="text-center tabular-nums">{r.matches.filter((m) => m.status === "CANCELADO").length}</TD>
                    <TD className="text-center tabular-nums">{active.filter((m) => m.timeSlotId && !m.refereeId).length}</TD>
                    <TD>{r.locked ? <Badge className="bg-sky-100 text-sky-900 ring-sky-300">Confirmada · protegida</Badge> : <Badge>Editable</Badge>}</TD>
                    <TD>
                      <div className="flex flex-wrap justify-end gap-2">
                        {ctx.leagues.map((l) => (
                          <LinkButton key={l.id} href={`/api/pdf/rol?date=${iso}&league=${l.id}`} target="_blank" size="sm" variant="ghost">
                            Rol {l.name}
                          </LinkButton>
                        ))}
                        {r.phase === "REGULAR" && (
                          <RoundAdminButtons roundId={r.id} number={r.number} date={iso} locked={r.locked} lockAction={setRoundLockAction} dateAction={updateRoundDateAction} />
                        )}
                      </div>
                    </TD>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
