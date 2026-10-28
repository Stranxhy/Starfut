"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ActionForm, CheckboxField, ModalButton, SelectField, SubmitButton, TextArea, TextField, type ServerAction } from "@/components/ui/form";
import { Button, inputClass } from "@/components/ui/core";
import { describeSource, defaultZones, validateBracket, type BracketFormat, type Zone } from "@/domain/bracket";

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function GeneralForm({
  action,
  v,
}: {
  action: ServerAction;
  v: {
    tournamentName: string;
    modality: string;
    venueName: string;
    seasonName: string;
    startDate: string;
    weekday: number;
    regularRounds: number;
    allowInterLeague: boolean;
    excludedDates: string[];
  };
}) {
  return <ActionForm action={action} className="space-y-6" confirmLabel="Guardar de todos modos">
    <fieldset className="min-w-0 rounded-xl border border-slate-200 p-4 sm:p-5">
      <legend className="px-2 text-base font-bold text-[#102d50]">Identidad del torneo</legend>
      <p className="mb-4 max-w-prose text-xs leading-relaxed text-slate-600">El nombre del torneo, la modalidad y la sede se comparten con las temporadas que los utilizan. La sede también aparece en los PDF.</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <TextField name="tournamentName" label="Nombre del torneo" required maxLength={80} defaultValue={v.tournamentName} />
        <TextField name="modality" label="Modalidad" required maxLength={40} defaultValue={v.modality} />
        <TextField name="venueName" label="Nombre de la sede" required maxLength={80} defaultValue={v.venueName} />
      </div>
    </fieldset>
    <fieldset className="min-w-0 rounded-xl border border-slate-200 p-4 sm:p-5">
      <legend className="px-2 text-base font-bold text-[#102d50]">Calendario de la temporada</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="seasonName" label="Nombre de la temporada" required maxLength={80} defaultValue={v.seasonName} />
        <TextField name="startDate" type="date" label="Primera fecha de juego" required defaultValue={v.startDate} />
        <SelectField name="weekday" label="Día habitual de juego" options={WEEKDAYS.map((day, index) => ({ value: String(index), label: day }))} defaultValue={String(v.weekday)} />
        <TextField name="regularRounds" type="number" min={1} max={60} label="Jornadas de fase regular" required defaultValue={v.regularRounds} />
        <TextArea name="excludedDates" label="Fechas sin jornada" hint="(opcional)" defaultValue={v.excludedDates.join("\n")} rows={3} placeholder="2026-12-25" className="sm:col-span-2" />
        <p className="text-xs leading-relaxed text-slate-600 sm:col-span-2">Escribe una fecha por línea en formato AAAA-MM-DD. Estas fechas se omiten al preparar nuevas jornadas.</p>
      </div>
    </fieldset>
    <fieldset className="min-w-0 rounded-xl border border-slate-200 p-4 sm:p-5">
      <legend className="px-2 text-base font-bold text-[#102d50]">Opciones de programación</legend>
      <CheckboxField name="allowInterLeague" defaultChecked={v.allowInterLeague} label="Permitir combinar equipos de ligas diferentes" hint="Para completar la jornada cuando un equipo se queda sin partido. El calendario automático nunca mezcla ligas." />
    </fieldset>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5"><p className="text-xs text-slate-600">Los cambios se aplican al guardar.</p><SubmitButton>Guardar configuración</SubmitButton></div>
  </ActionForm>;
}

export function TimeSlotForm({ action, slot }: { action: ServerAction; slot?: { id: string; startTime: string; durationMinutes: number } }) {
  return (
    <ActionForm action={action} resetOnSuccess={!slot} className="flex flex-wrap items-end gap-2">
      {slot && <input type="hidden" name="id" value={slot.id} />}
      <TextField name="startTime" type="time" label="Hora de inicio" required defaultValue={slot?.startTime} className="w-32" />
      <TextField name="durationMinutes" type="number" min={10} max={240} label="Duración (min)" required defaultValue={slot?.durationMinutes ?? 50} className="w-24" />
      <SubmitButton size="sm" variant={slot ? "secondary" : "primary"}>{slot ? "Guardar" : "Agregar horario"}</SubmitButton>
    </ActionForm>
  );
}

export function FieldForm({ action, field }: { action: ServerAction; field?: { id: string; name: string; sortOrder: number } }) {
  return (
    <ActionForm action={action} resetOnSuccess={!field} className="flex flex-wrap items-end gap-2">
      {field && <input type="hidden" name="id" value={field.id} />}
      <TextField name="name" label="Nombre de la cancha" required defaultValue={field?.name} className="min-w-0 flex-1" />
      <TextField name="sortOrder" type="number" min={0} max={99} label="Orden" defaultValue={field?.sortOrder ?? 0} className="w-20" />
      <SubmitButton size="sm" variant={field ? "secondary" : "primary"}>{field ? "Guardar" : "Agregar cancha"}</SubmitButton>
    </ActionForm>
  );
}

export function FieldBlockForm({ action, fields, slots }: { action: ServerAction; fields: { value: string; label: string }[]; slots: { value: string; label: string }[] }) {
  return (
    <ActionForm action={action} resetOnSuccess confirmLabel="Bloquear de todos modos" className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SelectField name="fieldId" label="Cancha" required options={fields} />
      <TextField name="date" type="date" label="Fecha" required />
      <SelectField name="timeSlotId" label="Horario" options={slots} placeholder="Todo el día" />
      <TextField name="reason" label="Motivo" maxLength={200} />
      <div className="sm:col-span-2 xl:col-span-4"><SubmitButton>Agregar bloqueo</SubmitButton></div>
    </ActionForm>
  );
}

export function ScoringForm({
  action,
  leagueId,
  v,
}: {
  action: ServerAction;
  leagueId?: string;
  v: { winPoints: number; lossPoints: number; shootoutWinPoints: number; shootoutLossPoints: number; allowDraws: boolean; drawPoints: number | null; shootoutKicks?: number | null };
}) {
  const [draws, setDraws] = useState(v.allowDraws);
  return (
    <ActionForm action={action} confirmLabel="Guardar y recalcular" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {leagueId && <input type="hidden" name="leagueId" value={leagueId} />}
      <TextField name="winPoints" type="number" min={0} max={20} label="Victoria (tiempo regular)" required defaultValue={v.winPoints} />
      <TextField name="lossPoints" type="number" min={0} max={20} label="Derrota (tiempo regular)" required defaultValue={v.lossPoints} />
      <TextField name="shootoutWinPoints" type="number" min={0} max={20} label="Victoria por desempate" required defaultValue={v.shootoutWinPoints} />
      <TextField name="shootoutLossPoints" type="number" min={0} max={20} label="Derrota por desempate" required defaultValue={v.shootoutLossPoints} />
      <TextField
        name="shootoutKicks"
        type="number"
        min={1}
        max={20}
        label="Tiros por equipo en penales"
        hint="(después, muerte súbita; vacío = no validar)"
        defaultValue={v.shootoutKicks ?? ""}
        className="sm:col-span-2"
      />
      <div className="sm:col-span-2 xl:col-span-4 flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allowDraws" value="1" checked={draws} onChange={(e) => setDraws(e.target.checked)} className="accent-blue-800" />
          Permitir empate definitivo (sin desempate)
        </label>
        {draws && <TextField name="drawPoints" type="number" min={0} max={20} label="Puntos por empate definitivo" required defaultValue={v.drawPoints ?? ""} className="w-48" />}
      </div>
      <p className="text-xs text-zinc-500 sm:col-span-2 xl:col-span-4">
        Los partidos pendientes, cancelados y amistosos nunca asignan puntos automáticamente. El empate definitivo permanece desactivado hasta que el reglamento oficial defina sus puntos.
      </p>
      <div className="flex justify-end sm:col-span-2 xl:col-span-4">
        <SubmitButton>Guardar puntuación</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function TiebreakForm({
  action,
  leagueId,
  criteria,
  scorerCriteria,
  options,
  scorerOptions,
}: {
  action: ServerAction;
  leagueId?: string;
  criteria: string[];
  scorerCriteria: string[];
  options: { value: string; label: string }[];
  scorerOptions: { value: string; label: string }[];
}) {
  return (
    <ActionForm action={action} confirmLabel="Confirmar orden" className="grid gap-6 lg:grid-cols-2">
      {leagueId && <input type="hidden" name="leagueId" value={leagueId} />}
      <fieldset className="min-w-0 rounded-xl border border-slate-200 p-4">
        <legend className="px-2 text-sm font-bold text-[#102d50]">Tabla general: orden de prioridad</legend>
        <div className="space-y-2">
          {Array.from({ length: options.length }).map((_, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-right font-bold text-zinc-400">{i + 1}.</span>
              <select name="criteria" aria-label={`Criterio ${i + 1} de la tabla general`} defaultValue={criteria[i] ?? ""} className="filter-control">
                <option value="">— (sin criterio)</option>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">El enfrentamiento directo se calcula como mini tabla entre todos los equipos empatados. Si el empate persiste, se conserva y se solicita decisión oficial.</p>
      </fieldset>
      <fieldset className="min-w-0 rounded-xl border border-slate-200 p-4">
        <legend className="px-2 text-sm font-bold text-[#102d50]">Goleadores: orden de prioridad</legend>
        <div className="space-y-2">
          {Array.from({ length: scorerOptions.length }).map((_, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-right font-bold text-zinc-400">{i + 1}.</span>
              <select name="scorerCriteria" aria-label={`Criterio ${i + 1} de goleadores`} defaultValue={scorerCriteria[i] ?? ""} className="filter-control">
                <option value="">— (sin criterio)</option>
                {scorerOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">Sin criterios, los jugadores con los mismos goles comparten la posición.</p>
      </fieldset>
      <div className="flex justify-end lg:col-span-2">
        <SubmitButton>Guardar criterios</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function BracketEditor({
  action,
  leagueId,
  initial,
  initialZones,
  teamCount,
  officialConfirmed,
  locked,
}: {
  action: ServerAction;
  leagueId: string;
  initial: BracketFormat;
  initialZones: Zone[];
  teamCount: number;
  officialConfirmed: boolean;
  locked: boolean;
}) {
  const [stages, setStages] = useState(initial.stages.map((s) => ({ ...s, ties: s.ties.map((t) => ({ ...t })) })));
  const [zones, setZones] = useState<Zone[]>(initialZones);
  const [autoZones, setAutoZones] = useState(initialZones.length === 0);
  const format = useMemo(() => ({ stages }), [stages]);
  const errors = useMemo(() => validateBracket(format, Math.max(teamCount, 999)), [format, teamCount]);
  const sizeWarnings = useMemo(() => validateBracket(format, teamCount).filter((e) => e.includes("solo tiene")), [format, teamCount]);
  const stageNames = Object.fromEntries(stages.map((s) => [s.code, s.name]));
  const shownZones = autoZones ? defaultZones(format, Math.max(teamCount, 1)) : zones;

  const sourceOptions = (si: number) => {
    const opts: { value: string; label: string }[] = [];
    for (let p = 1; p <= Math.max(teamCount, 16); p++) opts.push({ value: `S${p}`, label: `${p}.º lugar` });
    for (const prev of stages.slice(0, si)) {
      prev.ties.forEach((_, ti) => {
        opts.push({ value: `W:${prev.code}:${ti + 1}`, label: `Ganador ${prev.name} ${ti + 1}` });
        opts.push({ value: `L:${prev.code}:${ti + 1}`, label: `Perdedor ${prev.name} ${ti + 1}` });
      });
    }
    return opts;
  };
  const update = (si: number, fn: (s: (typeof stages)[number]) => (typeof stages)[number]) => setStages((l) => l.map((s, i) => (i === si ? fn(s) : s)));

  return (
    <ActionForm action={action} confirmLabel="Guardar de todos modos" className="space-y-5">
      <input type="hidden" name="leagueId" value={leagueId} />
      <input type="hidden" name="stages" value={JSON.stringify(format)} />
      <input type="hidden" name="zones" value={JSON.stringify(autoZones ? [] : zones)} />
      <div className="grid gap-4 xl:grid-cols-2">
        {stages.map((s, si) => (
          <fieldset key={si} disabled={locked} className="min-w-0 rounded-xl border border-slate-300 bg-slate-50 p-4">
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <label className="text-xs font-semibold text-zinc-700">
                Código
                <input value={s.code} onChange={(e) => update(si, (x) => ({ ...x, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") }))} className={`${inputClass} mt-1 w-36`} />
              </label>
              <label className="min-w-0 flex-1 text-xs font-semibold text-slate-700">
                Nombre
                <input value={s.name} onChange={(e) => update(si, (x) => ({ ...x, name: e.target.value }))} className={`${inputClass} mt-1`} />
              </label>
              <Button size="sm" variant="danger" onClick={() => setStages((l) => l.filter((_, i) => i !== si))} aria-label="Eliminar etapa">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {s.ties.map((t, ti) => (
                <div key={ti} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-6 text-right font-bold text-zinc-400">{ti + 1}</span>
                  {(["home", "away"] as const).map((side) => (
                    <select
                      key={side}
                      aria-label={side === "home" ? "Primer equipo" : "Segundo equipo"}
                      value={t[side]}
                      onChange={(e) => update(si, (x) => ({ ...x, ties: x.ties.map((y, j) => (j === ti ? { ...y, [side]: e.target.value } : y)) }))}
                      className="filter-control min-w-0 flex-1 basis-40"
                    >
                      {!sourceOptions(si).some((o) => o.value === t[side]) && <option value={t[side]}>{describeSource(t[side], stageNames)}</option>}
                      {sourceOptions(si).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ))}
                  <button type="button" onClick={() => update(si, (x) => ({ ...x, ties: x.ties.filter((_, j) => j !== ti) }))} className="rounded p-1 text-zinc-400 hover:text-red-700" aria-label="Quitar cruce">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => update(si, (x) => ({ ...x, ties: [...x.ties, { home: "S1", away: "S2" }] }))}>
                <Plus className="h-4 w-4" /> Agregar cruce
              </Button>
            </div>
          </fieldset>
        ))}
      </div>
      {!locked && (
        <Button variant="secondary" onClick={() => setStages((l) => [...l, { code: `ETAPA${l.length + 1}`, name: `Etapa ${l.length + 1}`, ties: [{ home: "S1", away: "S2" }] }])}>
          <Plus className="h-4 w-4" /> Agregar etapa
        </Button>
      )}
      {errors.length > 0 && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-900 ring-1 ring-red-200">
          <p className="font-semibold">Corrige el cuadro:</p>
          <ul className="list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      {sizeWarnings.length > 0 && (
        <details className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">El cuadro necesita más equipos: {sizeWarnings.length} posiciones por revisar</summary>
          <p className="mt-2">Hay {teamCount} equipos activos en esta liga.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{sizeWarnings.map((error) => <li key={error}>{error}</li>)}</ul>
        </details>
      )}

      <div className="rounded-xl border border-slate-300 bg-slate-50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold">Zonas de color de la tabla general</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoZones} disabled={locked} onChange={(e) => { setAutoZones(e.target.checked); if (!e.target.checked && zones.length === 0) setZones(defaultZones(format, Math.max(teamCount, 1))); }} className="accent-blue-800" />
            Automáticas según el cuadro
          </label>
        </div>
        <div className="space-y-2">
          {shownZones.map((z, zi) => (
            <div key={zi} className="flex flex-wrap items-center gap-2 text-sm">
              <input type="color" value={z.color} disabled={autoZones || locked} aria-label="Color" onChange={(e) => setZones((l) => l.map((x, j) => (j === zi ? { ...x, color: e.target.value } : x)))} className="h-9 w-12 rounded" />
              <input value={z.positions.join(", ")} disabled={autoZones || locked} aria-label="Posiciones" onChange={(e) => setZones((l) => l.map((x, j) => (j === zi ? { ...x, positions: e.target.value.split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0) } : x)))} className={`${inputClass} w-40`} placeholder="1, 2, 3" />
              <input value={z.label} disabled={autoZones || locked} aria-label="Etiqueta" onChange={(e) => setZones((l) => l.map((x, j) => (j === zi ? { ...x, label: e.target.value } : x)))} className={`${inputClass} min-w-0 flex-1 basis-40`} />
              {!autoZones && !locked && (
                <button type="button" onClick={() => setZones((l) => l.filter((_, j) => j !== zi))} className="rounded p-1 text-zinc-400 hover:text-red-700" aria-label="Quitar zona">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {!autoZones && !locked && (
            <Button size="sm" variant="ghost" onClick={() => setZones((l) => [...l, { positions: [], label: "Nueva zona", color: "#cccccc" }])}>
              <Plus className="h-4 w-4" /> Agregar zona
            </Button>
          )}
        </div>
      </div>

      <CheckboxField name="officialConfirmed" defaultChecked={officialConfirmed} disabled={locked} label="Confirmo que estos cruces corresponden al cuadro oficial de la liga" hint="Mientras no se confirme, el sistema advertirá que el cuadro es una propuesta." />
      {!locked && (
        <div className="flex justify-end">
          <SubmitButton>Guardar formato</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

export function SeasonCreateButton({ action, seasons }: { action: ServerAction; seasons: { value: string; label: string }[] }) {
  return (
    <ModalButton label="Nueva temporada" title="Crear temporada" description="Prepara una temporada nueva y elige si quieres copiar la configuración y los participantes de una anterior." icon={<Plus className="h-4 w-4" />}>
      {(close) => (
        <ActionForm action={action} onSuccess={close} className="space-y-3">
          <TextField name="name" label="Nombre" required placeholder="Temporada 2027" />
          <TextField name="startDate" type="date" label="Primera fecha de juego" required />
          <SelectField name="copyFrom" label="Copiar configuración de" options={seasons} placeholder="(configuración inicial)" />
          <CheckboxField name="copyTeams" label="Copiar equipos activos" hint="Se crean como equipos nuevos de la temporada; el historial anterior se conserva." />
          <CheckboxField name="copyPlayers" label="Copiar también sus jugadores activos" />
          <CheckboxField name="setCurrent" label="Marcar como temporada vigente" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancelar</Button>
            <SubmitButton>Crear temporada</SubmitButton>
          </div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function CatalogAddForm({ action, withKind }: { action: ServerAction; withKind?: boolean }) {
  return (
    <ActionForm action={action} resetOnSuccess className="flex flex-wrap items-end gap-2">
      <TextField name="name" label="Nombre" required className="min-w-0 flex-1 basis-48" />
      {withKind && (
        <SelectField
          name="kind"
          label="Tipo de unidad"
          options={[
            { value: "PARTIDOS", label: "Partidos" },
            { value: "MINUTOS", label: "Minutos de juego" },
            { value: "DIAS", label: "Días" },
            { value: "OTRA", label: "Otra" },
          ]}
        />
      )}
      <SubmitButton>Agregar</SubmitButton>
    </ActionForm>
  );
}
