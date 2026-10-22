"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton, TextArea, type ServerAction } from "@/components/ui/form";
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

const num = "w-16 rounded-lg border-0 px-2 py-2 text-center text-lg font-bold tabular-nums ring-1 ring-zinc-300 focus:ring-2 focus:ring-brand-600";

export function ResultForm({ action, match, existing, existingScorers = [], rosters, rules, compact }: ResultFormProps) {
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
    <div className="rounded-lg bg-zinc-50 p-3 ring-1 ring-zinc-200">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{team.name}</p>
        <span className={`text-xs ${assigned > goals ? "font-bold text-red-700" : "text-zinc-500"}`}>
          {assigned} de {goals || 0} gol(es) con autor{assigned < goals ? ` · ${goals - assigned} sin autor registrado` : ""}
        </span>
      </div>
      {scorers.map((s, i) =>
        s.teamId !== team.id ? null : (
          <div key={i} className="mb-2 flex items-center gap-2">
            <select
              aria-label="Jugador"
              value={s.playerId}
              onChange={(e) => setScorers((l) => l.map((x, j) => (j === i ? { ...x, playerId: e.target.value } : x)))}
              className={`${inputClass} flex-1`}
            >
              <option value="">Selecciona jugador…</option>
              {roster.map((p) => (
                <option key={p.id} value={p.id} disabled={scorers.some((x, j) => j !== i && x.playerId === p.id)}>
                  {p.jerseyNumber != null ? `#${p.jerseyNumber} ` : ""}
                  {p.fullName}
                </option>
              ))}
            </select>
            <input
              aria-label="Goles"
              type="number"
              min={1}
              max={99}
              value={s.goals}
              onChange={(e) => setScorers((l) => l.map((x, j) => (j === i ? { ...x, goals: Number(e.target.value) } : x)))}
              className="w-16 rounded-lg border-0 px-2 py-2 text-center ring-1 ring-zinc-300"
            />
            <button type="button" aria-label="Quitar goleador" onClick={() => setScorers((l) => l.filter((_, j) => j !== i))} className="rounded p-2 text-zinc-500 hover:bg-red-50 hover:text-red-700">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={roster.length === 0}
        onClick={() => setScorers((l) => [...l, { playerId: "", teamId: team.id, goals: 1 }])}
      >
        <Plus className="h-4 w-4" /> Agregar goleador
      </Button>
      {roster.length === 0 && <p className="text-xs text-zinc-500">El equipo no tiene jugadores registrados.</p>}
    </div>
  );

  return (
    <ActionForm action={action} className={compact ? "" : "space-y-4"} successMessage="Resultado guardado.">
      <input type="hidden" name="matchId" value={match.id} />
      <input type="hidden" name="resultType" value={type} />
      {compact ? <input type="hidden" name="keepScorers" value="1" /> : <input type="hidden" name="scorers" value={JSON.stringify(scorers.filter((s) => s.playerId))} />}

      <div className={`flex flex-wrap items-center gap-3 ${compact ? "" : "justify-center"}`}>
        <span className={`min-w-0 text-right font-semibold ${compact ? "w-40 truncate text-sm" : "flex-1 text-base"}`}>{match.homeTeam.name}</span>
        <input aria-label={`Goles de ${match.homeTeam.name}`} name="homeGoals" type="number" min={0} max={99} required value={hg} onChange={(e) => setHg(e.target.value)} className={num} />
        <span className="text-xs font-bold text-zinc-400">VS</span>
        <input aria-label={`Goles de ${match.awayTeam.name}`} name="awayGoals" type="number" min={0} max={99} required value={ag} onChange={(e) => setAg(e.target.value)} className={num} />
        <span className={`min-w-0 font-semibold ${compact ? "w-40 truncate text-sm" : "flex-1 text-base"}`}>{match.awayTeam.name}</span>
        {compact && <SubmitButton size="sm">{isCorrection ? "Corregir" : "Guardar"}</SubmitButton>}
      </div>

      {tied && !admin && (
        <div className={`mt-3 rounded-lg bg-amber-50 p-3 text-sm ring-1 ring-amber-200 ${compact ? "" : ""}`}>
          {canDraw && (
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={definitiveDraw} onChange={(e) => setDefinitiveDraw(e.target.checked)} className="accent-brand-700" />
              Empate definitivo (sin desempate) · {rules.drawPoints} pts c/u
            </label>
          )}
          {type === "DESEMPATE" && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-amber-900">Desempate (penales):</span>
              <input aria-label="Penales local" name="homeShootout" type="number" min={0} max={99} value={hp} onChange={(e) => setHp(e.target.value)} className="w-16 rounded-lg border-0 px-2 py-1.5 text-center ring-1 ring-amber-300" />
              <span className="text-xs">-</span>
              <input aria-label="Penales visitante" name="awayShootout" type="number" min={0} max={99} value={ap} onChange={(e) => setAp(e.target.value)} className="w-16 rounded-lg border-0 px-2 py-1.5 text-center ring-1 ring-amber-300" />
              {hp === "" && ap === "" && (
                <label className="flex items-center gap-2 text-xs">
                  o ganador:
                  <select name="winnerTeamId" value={winner} onChange={(e) => setWinner(e.target.value)} className="rounded-md py-1 text-xs ring-1 ring-amber-300">
                    <option value="">—</option>
                    <option value={match.homeTeam.id}>{match.homeTeam.name}</option>
                    <option value={match.awayTeam.id}>{match.awayTeam.name}</option>
                  </select>
                </label>
              )}
              <span className="text-xs text-amber-800">
                {rules.shootoutKicks ? `${rules.shootoutKicks} tiros por equipo y luego muerte súbita. ` : ""}Los penales no suman goles.
              </span>
            </div>
          )}
        </div>
      )}

      {!compact && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} className="accent-brand-700" />
              Resultado por decisión administrativa oficial
            </label>
            {admin && (
              <select name="winnerTeamId" value={winner} onChange={(e) => setWinner(e.target.value)} required className="rounded-md py-1.5 text-sm ring-1 ring-zinc-300">
                <option value="">Ganador…</option>
                <option value={match.homeTeam.id}>{match.homeTeam.name}</option>
                <option value={match.awayTeam.id}>{match.awayTeam.name}</option>
              </select>
            )}
            <span className="text-xs text-zinc-500">Tipo: {RESULT_TYPE[type]}</span>
          </div>
          {rosters && (
            <div>
              <p className="mb-2 text-xs font-bold tracking-wide text-zinc-500 uppercase">Goleadores (solo si se conoce quién anotó)</p>
              <div className="grid gap-3 lg:grid-cols-2">
                {scorerBlock(match.homeTeam, rosters.home, Number(hg) || 0, sums.h)}
                {scorerBlock(match.awayTeam, rosters.away, Number(ag) || 0, sums.a)}
              </div>
            </div>
          )}
          <TextArea name="notes" label={admin ? "Resolución oficial / observaciones" : "Observaciones"} defaultValue={existing?.notes ?? ""} required={admin} />
          {isCorrection && <TextArea name="reason" label="Motivo de la corrección" required placeholder="Obligatorio: se registra con el valor anterior y el nuevo" />}
          <div className="flex justify-end">
            <SubmitButton>{isCorrection ? "Guardar corrección" : "Guardar resultado"}</SubmitButton>
          </div>
        </>
      )}
      {compact && isCorrection && (
        <div className="mt-2">
          <input name="reason" placeholder="Motivo de la corrección (obligatorio si cambias el marcador)" className={`${inputClass} text-xs`} />
        </div>
      )}
    </ActionForm>
  );
}
