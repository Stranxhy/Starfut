"use client";

import { useId, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ActionForm, FieldError, SubmitButton, TextArea, type ServerAction } from "@/components/ui/form";
import { Button, inputClass } from "@/components/ui/core";
import { RESULT_TYPE } from "@/lib/labels";

type Team = { id: string; name: string };
type Player = { id: string; fullName: string; jerseyNumber: number | null };
type Scorer = { playerId: string; teamId: string; goals: number };

export interface ResultFormProps {
  action: ServerAction;
  match: { id: string; homeTeam: Team; awayTeam: Team; isPlayoff: boolean };
  existing?: {
    resultType: string;
    homeGoals: number;
    awayGoals: number;
    homeShootout: number | null;
    awayShootout: number | null;
    winnerTeamId: string | null;
    notes: string | null;
  } | null;
  existingScorers?: Scorer[];
  rosters?: { home: Player[]; away: Player[] };
  rules: { allowDraws: boolean; drawPoints: number | null; shootoutKicks?: number | null };
  compact?: boolean;
}

const num = "h-16 w-20 max-w-full rounded-xl border-2 border-slate-400 bg-white px-2 text-center text-3xl font-extrabold text-[#102d50] tabular-nums focus:border-blue-700 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700";

export function ResultForm({ action, match, existing, existingScorers = [], rosters, rules, compact }: ResultFormProps) {
  const formId = useId();
  const [hg, setHg] = useState(existing ? String(existing.homeGoals) : "");
  const [ag, setAg] = useState(existing ? String(existing.awayGoals) : "");
  const [admin, setAdmin] = useState(existing?.resultType === "ADMINISTRATIVO");
  const [definitiveDraw, setDefinitiveDraw] = useState(existing?.resultType === "EMPATE");
  const [hp, setHp] = useState(existing?.homeShootout != null ? String(existing.homeShootout) : "");
  const [ap, setAp] = useState(existing?.awayShootout != null ? String(existing.awayShootout) : "");
  const [winner, setWinner] = useState(existing?.winnerTeamId ?? "");
  const [scorers, setScorers] = useState<Scorer[]>(existingScorers);
  const tied = hg !== "" && ag !== "" && Number(hg) === Number(ag);
  const canDraw = rules.allowDraws && rules.drawPoints != null && !match.isPlayoff;
  const type = admin ? "ADMINISTRATIVO" : tied ? (definitiveDraw && canDraw ? "EMPATE" : "DESEMPATE") : "TIEMPO_REGULAR";
  const isCorrection = !!existing;

  const sums = useMemo(() => {
    const h = scorers.filter((s) => s.teamId === match.homeTeam.id).reduce((a, s) => a + (Number(s.goals) || 0), 0);
    const a = scorers.filter((s) => s.teamId === match.awayTeam.id).reduce((x, s) => x + (Number(s.goals) || 0), 0);
    return { h, a };
  }, [scorers, match.homeTeam.id, match.awayTeam.id]);

  const scorerBlock = (team: Team, roster: Player[], goals: number, assigned: number) => (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-bold break-words text-[#102d50]">{team.name}</h3>
        <p className={`mt-1 text-xs ${assigned > goals ? "font-bold text-red-700" : "text-slate-600"}`}>
          {assigned} de {goals || 0} goles con autor{assigned < goals ? ` · ${goals - assigned} sin autor registrado` : ""}
        </p>
      </div>
      {scorers.map((s, i) => s.teamId !== team.id ? null : (
        <div key={i} className="mb-3 grid grid-cols-[minmax(0,1fr)_3.5rem_2.5rem] items-end gap-2">
          <div className="min-w-0">
            <label htmlFor={`${formId}-player-${i}`} className="mb-1 block text-xs font-semibold text-slate-600">Jugador</label>
            <select id={`${formId}-player-${i}`} value={s.playerId}
              onChange={(e) => setScorers((l) => l.map((x, j) => (j === i ? { ...x, playerId: e.target.value } : x)))} className={inputClass}>
              <option value="">Selecciona jugador…</option>
              {roster.map((p) => <option key={p.id} value={p.id} disabled={scorers.some((x, j) => j !== i && x.playerId === p.id)}>
                {p.jerseyNumber != null ? `#${p.jerseyNumber} ` : ""}{p.fullName}
              </option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${formId}-goals-${i}`} className="mb-1 block text-xs font-semibold text-slate-600">Goles</label>
            <input id={`${formId}-goals-${i}`} type="number" min={1} max={99} value={s.goals}
              onChange={(e) => setScorers((l) => l.map((x, j) => (j === i ? { ...x, goals: Number(e.target.value) } : x)))} className={`${inputClass} px-1 text-center`} />
          </div>
          <button type="button" aria-label={`Quitar goleador ${roster.find((p) => p.id === s.playerId)?.fullName ?? i + 1} de ${team.name}`}
            onClick={() => setScorers((l) => l.filter((_, j) => j !== i))} className="flex min-h-11 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-blue-700">
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}
      <Button size="sm" variant="secondary" disabled={roster.length === 0}
        onClick={() => setScorers((l) => [...l, { playerId: "", teamId: team.id, goals: 1 }])}>
        <Plus className="h-4 w-4" aria-hidden />Agregar goleador
      </Button>
      {roster.length === 0 && <p className="mt-2 text-xs text-slate-600">El equipo no tiene jugadores registrados.</p>}
    </div>
  );

  return (
    <ActionForm action={action} className="space-y-5" successMessage="Resultado guardado.">
      <input type="hidden" name="matchId" value={match.id} />
      <input type="hidden" name="resultType" value={type} />
      {compact ? <input type="hidden" name="keepScorers" value="1" /> : <input type="hidden" name="scorers" value={JSON.stringify(scorers.filter((s) => s.playerId))} />}

      <fieldset className="min-w-0 rounded-xl border border-blue-200 bg-blue-50/50 px-3 pb-5 sm:px-5">
        <legend className="px-2 text-xs font-bold tracking-wide text-[#102d50] uppercase">Goles del tiempo regular</legend>
        <div className="mx-auto grid max-w-xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 pt-3 text-center sm:gap-x-6">
          <label htmlFor={`${formId}-home`} className="min-w-0 self-start text-sm font-bold break-words text-[#102d50] sm:text-base">
            <span className="mb-1 block text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Local</span>{match.homeTeam.name}
          </label>
          <span className="col-start-2 row-span-2 row-start-1 text-xs font-bold text-slate-500" aria-hidden>VS</span>
          <label htmlFor={`${formId}-away`} className="col-start-3 min-w-0 self-start text-sm font-bold break-words text-[#102d50] sm:text-base">
            <span className="mb-1 block text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Visitante</span>{match.awayTeam.name}
          </label>
          <div className="col-start-1 row-start-2 self-start">
            <input id={`${formId}-home`} aria-label={`Goles de ${match.homeTeam.name}`} name="homeGoals" type="number" inputMode="numeric" min={0} max={99} required value={hg} onChange={(e) => setHg(e.target.value)} className={num} />
            <FieldError name="homeGoals" />
          </div>
          <div className="col-start-3 row-start-2 self-start">
            <input id={`${formId}-away`} aria-label={`Goles de ${match.awayTeam.name}`} name="awayGoals" type="number" inputMode="numeric" min={0} max={99} required value={ag} onChange={(e) => setAg(e.target.value)} className={num} />
            <FieldError name="awayGoals" />
          </div>
        </div>
      </fieldset>

      {tied && !admin && <fieldset className="min-w-0 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
        <legend className="px-2 font-bold text-amber-950">Resolver el empate</legend>
        {canDraw && <label className="mb-3 flex items-start gap-2 text-sm text-amber-950">
          <input type="checkbox" checked={definitiveDraw} onChange={(e) => setDefinitiveDraw(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-800" />
          Empate definitivo, sin penales · {rules.drawPoints} puntos por equipo
        </label>}
        {type === "DESEMPATE" && <>
          <p className="mb-3 text-xs leading-relaxed text-amber-900">{rules.shootoutKicks ? `${rules.shootoutKicks} tiros por equipo y luego muerte súbita. ` : ""}Los penales se registran aparte y no suman goles al marcador.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${formId}-home-pen`} className="mb-1.5 block text-xs font-semibold text-amber-950">Penales · local</label>
              <input id={`${formId}-home-pen`} name="homeShootout" type="number" inputMode="numeric" min={0} max={99} required={ap !== ""} value={hp} onChange={(e) => setHp(e.target.value)} className={`${inputClass} text-center font-bold tabular-nums`} />
              <FieldError name="homeShootout" />
            </div>
            <div>
              <label htmlFor={`${formId}-away-pen`} className="mb-1.5 block text-xs font-semibold text-amber-950">Penales · visitante</label>
              <input id={`${formId}-away-pen`} name="awayShootout" type="number" inputMode="numeric" min={0} max={99} required={hp !== ""} value={ap} onChange={(e) => setAp(e.target.value)} className={`${inputClass} text-center font-bold tabular-nums`} />
              <FieldError name="awayShootout" />
            </div>
          </div>
          {hp === "" && ap === "" && <div className="mt-3">
            <label htmlFor={`${formId}-winner`} className="mb-1.5 block text-xs font-semibold text-amber-950">Si no conoces la cuenta de penales, elige al ganador</label>
            <select id={`${formId}-winner`} name="winnerTeamId" value={winner} onChange={(e) => setWinner(e.target.value)} required className={inputClass}>
              <option value="">Selecciona el ganador…</option>
              <option value={match.homeTeam.id}>{match.homeTeam.name}</option>
              <option value={match.awayTeam.id}>{match.awayTeam.name}</option>
            </select>
            <FieldError name="winnerTeamId" />
          </div>}
        </>}
      </fieldset>}

      {!compact && <>
        <div className="rounded-xl border border-slate-200 p-4">
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-800" />
            Resultado por decisión administrativa oficial
          </label>
          {admin && <div className="mt-3">
            <label htmlFor={`${formId}-admin-winner`} className="mb-1.5 block text-sm font-semibold text-slate-700">Equipo ganador según la resolución</label>
            <select id={`${formId}-admin-winner`} name="winnerTeamId" value={winner} onChange={(e) => setWinner(e.target.value)} required className={inputClass}>
              <option value="">Selecciona el ganador…</option>
              <option value={match.homeTeam.id}>{match.homeTeam.name}</option>
              <option value={match.awayTeam.id}>{match.awayTeam.name}</option>
            </select>
            <FieldError name="winnerTeamId" />
          </div>}
        </div>
        {rosters && <section aria-labelledby={`${formId}-scorers`}>
          <h2 id={`${formId}-scorers`} className="text-sm font-bold text-[#102d50]">Goleadores</h2>
          <p className="mt-1 mb-3 text-xs text-slate-600">Registra a los jugadores que anotaron cuando conozcas el dato. Los goles de penales no se asignan aquí.</p>
          <div className="grid gap-4 xl:grid-cols-2">
            {scorerBlock(match.homeTeam, rosters.home, Number(hg) || 0, sums.h)}
            {scorerBlock(match.awayTeam, rosters.away, Number(ag) || 0, sums.a)}
          </div>
        </section>}
        <TextArea name="notes" label={admin ? "Resolución oficial / observaciones" : "Observaciones (opcional)"} defaultValue={existing?.notes ?? ""} required={admin} />
      </>}
      {isCorrection && <TextArea name="reason" label="Motivo de la corrección" required placeholder="Explica el cambio; quedará registrado en el historial." />}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <p className="text-xs text-slate-600">{hg !== "" && ag !== "" ? `Tipo: ${RESULT_TYPE[type]}` : "Completa los goles de ambos equipos."}</p>
        <SubmitButton>{isCorrection ? "Guardar corrección" : "Guardar resultado"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
