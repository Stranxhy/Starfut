"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionForm, SubmitButton, TextArea, type ServerAction } from "@/components/ui/form";
import { inputClass } from "@/components/ui/core";
import { freeRefereesAction, freeSlotsAction } from "@/server/actions/matches";
import { MATCH_TYPE } from "@/lib/labels";

interface TeamOpt {
  id: string;
  name: string;
  leagueId: string;
  leagueName: string;
  active: boolean;
}

export interface MatchFormProps {
  action: ServerAction<{ id: string } | undefined>;
  mode: "create" | "edit" | "reschedule";
  matchId?: string;
  teams: TeamOpt[];
  slots: { id: string; startTime: string }[];
  fields: { id: string; name: string }[];
  referees: { id: string; name: string }[];
  initial?: {
    type?: string;
    homeTeamId?: string;
    awayTeamId?: string;
    date?: string | null;
    timeSlotId?: string | null;
    fieldId?: string | null;
    refereeId?: string | null;
    countsForStandings?: boolean;
    notes?: string | null;
  };
  replacesMatchId?: string;
  requireReason?: boolean;
  teamsEditable?: boolean;
  allowedTypes?: string[];
  candidates?: { id: string; name: string; leagueName: string; sameLeague: boolean; playsThatDay: boolean }[];
}

export function MatchForm(p: MatchFormProps) {
  const router = useRouter();
  const [type, setType] = useState(p.initial?.type ?? (p.replacesMatchId ? "SUSTITUCION" : "OFICIAL"));
  const [home, setHome] = useState(p.initial?.homeTeamId ?? "");
  const [away, setAway] = useState(p.initial?.awayTeamId ?? "");
  const [date, setDate] = useState(p.initial?.date ?? "");
  const [slot, setSlot] = useState(p.initial?.timeSlotId ?? "");
  const [field, setField] = useState(p.initial?.fieldId ?? "");
  const [referee, setReferee] = useState(p.initial?.refereeId ?? "");
  const [free, setFree] = useState<{ timeSlotId: string; startTime: string; fieldId: string; fieldName: string }[] | null>(null);
  const [freeRefs, setFreeRefs] = useState<Set<string> | null>(null);
  const [, start] = useTransition();
  const teamsEditable = p.teamsEditable ?? true;

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setFree(null);
      return;
    }
    start(async () => setFree(await freeSlotsAction(date)));
  }, [date]);

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !slot) {
      setFreeRefs(null);
      return;
    }
    start(async () => setFreeRefs(new Set((await freeRefereesAction(date, slot, p.matchId)).map((r) => r.id))));
  }, [date, slot, p.matchId]);

  const homeLeague = p.teams.find((t) => t.id === home)?.leagueId;
  const crossLeague = type === "INTERLIGA" || type === "AMISTOSO";
  const byLeague = useMemo(() => {
    const m = new Map<string, TeamOpt[]>();
    for (const t of p.teams) {
      if (!t.active && t.id !== home && t.id !== away) continue;
      m.set(t.leagueName, [...(m.get(t.leagueName) ?? []), t]);
    }
    return [...m.entries()];
  }, [p.teams, home, away]);
  const types = (p.allowedTypes ?? ["OFICIAL", "SUSTITUCION", "AMISTOSO", "INTERLIGA"]).filter((t) => MATCH_TYPE[t]);
  const ownSlotFree = (tsId: string, fId: string) => p.initial?.date === date && p.initial?.timeSlotId === tsId && p.initial?.fieldId === fId;

  const teamSelect = (name: string, value: string, set: (v: string) => void, label: string, other: string) => (
    <div>
      <label className="mb-1 block text-xs font-semibold text-zinc-700" htmlFor={`mf-${name}`}>
        {label} <span className="text-brand-700">*</span>
      </label>
      <select id={`mf-${name}`} name={name} value={value} onChange={(e) => set(e.target.value)} required disabled={!teamsEditable} className={inputClass}>
        <option value="">Selecciona…</option>
        {byLeague.map(([league, list]) => (
          <optgroup key={league} label={league}>
            {list.map((t) => (
              <option key={t.id} value={t.id} disabled={t.id === other || (!crossLeague && name === "awayTeamId" && !!homeLeague && t.leagueId !== homeLeague)}>
                {t.name}
                {!t.active ? " (baja)" : ""}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {!teamsEditable && <input type="hidden" name={name} value={value} />}
    </div>
  );

  return (
    <ActionForm
      action={p.action}
      confirmLabel="Guardar a pesar de las advertencias"
      onSuccess={(r) => {
        const id = (r.data as { id?: string } | undefined)?.id;
        if (p.mode === "create" && id) router.push(`/partidos/${id}`);
      }}
      className="space-y-4"
    >
      {p.matchId && <input type="hidden" name="id" value={p.matchId} />}
      {p.mode === "reschedule" && <input type="hidden" name="reschedule" value="1" />}
      {p.replacesMatchId && <input type="hidden" name="replacesMatchId" value={p.replacesMatchId} />}

      {teamsEditable ? (
        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-zinc-700">
            Naturaleza del encuentro <span className="text-brand-700">*</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {types.map((t) => (
              <label key={t} className={`flex cursor-pointer gap-2 rounded-lg p-3 text-sm ring-1 ${type === t ? "bg-brand-50 ring-brand-500" : "ring-zinc-200 hover:bg-zinc-50"}`}>
                <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="mt-0.5 accent-brand-700" />
                <span>
                  <span className="block font-semibold">{MATCH_TYPE[t].label}</span>
                  <span className="text-xs text-zinc-600">{MATCH_TYPE[t].description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <input type="hidden" name="type" value={type} />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {teamSelect("homeTeamId", home, setHome, "Equipo local (primer equipo)", away)}
        {teamSelect("awayTeamId", away, setAway, "Equipo visitante (segundo equipo)", home)}
      </div>
      {p.candidates && p.candidates.length > 0 && (
        <div className="rounded-lg bg-zinc-50 p-3 text-xs ring-1 ring-zinc-200">
          <p className="mb-2 font-semibold text-zinc-700">Equipos disponibles en ese horario (prioridad: misma liga y sin partido ese día):</p>
          <div className="flex flex-wrap gap-1.5">
            {p.candidates.slice(0, 24).map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => (home ? setAway(c.id) : setHome(c.id))}
                className={`rounded-full px-2 py-1 ring-1 ${c.sameLeague ? "bg-white ring-zinc-300" : "bg-fuchsia-50 ring-fuchsia-200"} hover:ring-brand-500`}
                title={c.playsThatDay ? "Ya juega ese día" : "No juega ese día"}
              >
                {c.name}
                {!c.sameLeague && ` · ${c.leagueName}`}
                {c.playsThatDay && " ·⚠"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700" htmlFor="mf-date">Fecha</label>
          <input id="mf-date" type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700" htmlFor="mf-slot">Horario</label>
          <select id="mf-slot" name="timeSlotId" value={slot} onChange={(e) => setSlot(e.target.value)} className={inputClass}>
            <option value="">Sin asignar</option>
            {p.slots.map((s) => (
              <option key={s.id} value={s.id}>{s.startTime}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700" htmlFor="mf-field">Cancha</label>
          <select id="mf-field" name="fieldId" value={field} onChange={(e) => setField(e.target.value)} className={inputClass}>
            <option value="">Sin asignar</option>
            {p.fields.map((f) => {
              const busy = free && slot ? !free.some((x) => x.timeSlotId === slot && x.fieldId === f.id) && !ownSlotFree(slot, f.id) : false;
              return (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {busy ? " (ocupada)" : ""}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700" htmlFor="mf-ref">Árbitro</label>
          <select id="mf-ref" name="refereeId" value={referee} onChange={(e) => setReferee(e.target.value)} className={inputClass}>
            <option value="">Sin asignar</option>
            {p.referees.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {freeRefs && !freeRefs.has(r.id) ? " (no disponible)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
      {free && (
        <div className="text-xs">
          <p className="mb-1 font-semibold text-zinc-600">
            Espacios libres el {date.split("-").reverse().join("/")}: {free.length === 0 && <span className="text-red-700">ninguno</span>}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {free.slice(0, 30).map((f) => (
              <button
                type="button"
                key={`${f.timeSlotId}-${f.fieldId}`}
                onClick={() => {
                  setSlot(f.timeSlotId);
                  setField(f.fieldId);
                }}
                className={`rounded-md px-2 py-1 ring-1 ${slot === f.timeSlotId && field === f.fieldId ? "bg-brand-700 text-white ring-brand-700" : "bg-white ring-zinc-300 hover:ring-brand-500"}`}
              >
                {f.startTime} · {f.fieldName}
              </button>
            ))}
          </div>
        </div>
      )}

      <TextArea name="notes" label="Observaciones" defaultValue={p.initial?.notes ?? ""} maxLength={500} />
      {(p.requireReason || p.mode === "reschedule") && (
        <TextArea name="reason" label="Motivo del cambio" required placeholder="Se registrará en el historial" />
      )}
      <div className="flex justify-end">
        <SubmitButton>{p.mode === "create" ? "Crear partido" : p.mode === "reschedule" ? "Reprogramar" : "Guardar cambios"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
