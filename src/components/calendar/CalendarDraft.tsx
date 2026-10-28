import { ChevronDown } from "lucide-react";
import type { getActiveDraft } from "@/server/services/schedule";
import { confirmDraftAction, discardDraftAction, regenerateDraftAction } from "@/server/actions/schedule";
import { DraftActions } from "@/components/forms/schedule-forms";
import { Alert, Badge, Card, CardHeader, StatCard, Table, TD, TH } from "@/components/ui/core";
import { formatDateTime, formatLong } from "@/lib/dates";

export function CalendarDraft({ draft, teams, slots, fields, leagues }: {
  draft: NonNullable<Awaited<ReturnType<typeof getActiveDraft>>>;
  teams: { id: string; name: string }[];
  slots: { id: string; startTime: string; active: boolean }[];
  fields: { id: string; name: string }[];
  leagues: { id: string; name: string }[];
}) {
  const teamName = new Map(teams.map((team) => [team.id, team.name]));
  const slotLabel = new Map(slots.map((slot) => [slot.id, slot.startTime]));
  const fieldName = new Map(fields.map((field) => [field.id, field.name]));
  const leagueName = new Map(leagues.map((league) => [league.id, league.name]));
  const activeSlots = slots.filter((slot) => slot.active);
  return (
    <Card className="min-w-0 border-t-4 border-t-orange-400">
      <CardHeader
        title="Revisa tu propuesta"
        description={`Jornadas ${draft.params.fromRound}–${draft.params.fromRound + draft.params.dates.length - 1}. Generada el ${formatDateTime(draft.createdAt)}. Aún no está confirmada.`}
      />
      <div className="space-y-4 px-4 py-4 sm:px-5">
        {draft.data.rounds.length > 0 && <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Partidos" value={draft.data.summary.totalMatches} />
          <StatCard label="Enfrentamientos repetidos" value={draft.data.summary.repeatedMatches} tone={draft.data.summary.repeatedMatches ? "warn" : "ok"} />
          <StatCard label="Con conflictos" value={draft.data.summary.conflicts} tone={draft.data.summary.conflicts ? "danger" : "ok"} />
          <StatCard label="Sin espacio" value={draft.data.summary.unscheduledMatches} tone={draft.data.summary.unscheduledMatches ? "danger" : "ok"} />
        </div>}
        {draft.data.errors.length > 0 && <Alert tone="danger" title="La propuesta necesita correcciones">
          <ul className="list-disc space-y-1 pl-5">{draft.data.errors.map((error) => <li key={error}>{error}</li>)}</ul>
          <p className="mt-2">Descarta esta propuesta para ajustar las ligas y fechas, o revisa las canchas y horarios en Configuración.</p>
        </Alert>}
        {draft.data.warnings.length > 0 && (
          <Alert tone="warn" title="Advertencias">
            <ul className="list-disc pl-5">{draft.data.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </Alert>
        )}
        {draft.data.summary.leagues.length > 0 && <details className="rounded-lg border border-slate-300">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-blue-900 focus-visible:outline-2 focus-visible:outline-blue-700">Verificación de enfrentamientos por liga</summary>
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
        </details>}

        {Object.keys(draft.data.summary.slotDistribution).length > 0 && <details className="rounded-lg border border-slate-300">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-blue-900 focus-visible:outline-2 focus-visible:outline-blue-700">Distribución de horarios por equipo</summary>
          <div className="p-4">
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
          </div>
        </details>}

        <div className="space-y-3">
          {draft.data.rounds.length > 0 && <h3 className="text-sm font-bold text-[#102d50]">Partidos propuestos por jornada</h3>}
          {draft.data.rounds.map((r, idx) => (
            <details key={r.number} open={idx === 0} className="group rounded-lg border border-slate-300 bg-white">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-700 [&::-webkit-details-marker]:hidden">
                <ChevronDown className="h-4 w-4 text-blue-900 group-open:rotate-180" aria-hidden /><span className="font-bold text-[#102d50]">Jornada {r.number}</span>
                <span className="text-zinc-600">{formatLong(r.date)}</span>
                <Badge>{r.matches.length} partidos</Badge>
                <Badge>{r.unusedSlots} espacios libres de {r.availableSlots}</Badge>
                {r.matches.some((m) => m.conflicts.length) && <Badge className="bg-red-100 text-red-900 ring-red-300">Conflictos</Badge>}
                {r.matches.some((m) => m.repeatIndex > 0) && <Badge className="bg-amber-100 text-amber-900 ring-amber-300">Repeticiones</Badge>}
              </summary>
              <Table>
                <thead>
                  <tr><TH>Horario</TH><TH>Cancha</TH><TH>Liga</TH><TH>Local</TH><TH /><TH>Visitante</TH><TH>Observaciones</TH></tr>
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
      <div className="rounded-b-xl border-t border-slate-200 bg-slate-50 p-4 sm:p-5">
        <h3 className="mb-1 text-sm font-bold text-[#102d50]">{draft.data.errors.length ? "Corrige la propuesta para continuar" : "Confirma cuando termines de revisar"}</h3>
        <p className="mb-4 max-w-3xl text-sm leading-relaxed text-slate-600">{draft.data.errors.length ? "La confirmación estará disponible cuando la propuesta se genere sin errores." : "Al confirmar se crean las jornadas y sus partidos, y quedan protegidos contra cambios accidentales. Las advertencias que requieren autorización se mostrarán antes de guardar."}</p>
        <DraftActions draftId={draft.id} canConfirm={draft.data.errors.length === 0} confirm={confirmDraftAction} discard={discardDraftAction} regenerate={regenerateDraftAction} />
      </div>
    </Card>
  );
}
