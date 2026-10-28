"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionForm, ConfirmAction, ModalButton, SubmitButton, TextArea, TextField, type ServerAction } from "@/components/ui/form";
import { CalendarDays, ShieldCheck } from "lucide-react";
import { Button, inputClass } from "@/components/ui/core";

export function GeneratorForm({ action, fromRound, dates, leagues, capacity }: {
  action: ServerAction;
  fromRound: number;
  dates: string[];
  leagues: { id: string; name: string; teams: number }[];
  capacity: number;
}) {
  const [values, setValues] = useState(dates);
  const [selected, setSelected] = useState(() => leagues.filter((league) => league.teams >= 2).map((league) => league.id));
  const matchesPerRound = leagues.filter((league) => selected.includes(league.id)).reduce((sum, league) => sum + Math.floor(league.teams / 2), 0);
  return (
    <ActionForm action={action} className="space-y-6">
      <input type="hidden" name="fromRound" value={fromRound} />
      <fieldset>
        <legend className="mb-1 text-base font-bold text-[#102d50]">1. Elige las ligas</legend>
        <p className="mb-4 text-sm text-slate-600">Cada liga necesita al menos dos equipos activos para programar sus partidos.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {leagues.map((league) => {
            const available = league.teams >= 2;
            const checked = selected.includes(league.id);
            return <label key={league.id} className={`flex min-w-0 items-start gap-3 rounded-xl border p-4 ${!available ? "border-slate-200 bg-slate-50 text-slate-500" : checked ? "border-blue-700 bg-blue-50 text-blue-950" : "cursor-pointer border-slate-300 bg-white text-slate-700 hover:border-blue-500"}`}>
              <input type="checkbox" name="leagueIds" value={league.id} checked={checked} disabled={!available}
                onChange={(event) => setSelected((previous) => event.target.checked ? [...previous, league.id] : previous.filter((id) => id !== league.id))}
                className="mt-0.5 h-4 w-4 shrink-0 accent-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" />
              <span className="min-w-0"><span className="block break-words text-sm font-bold">{league.name}</span><span className="mt-1 block text-xs">{league.teams} equipos activos{!available && " · completa el registro"}</span></span>
            </label>;
          })}
        </div>
        <p role="status" className={`mt-3 text-xs leading-relaxed ${matchesPerRound > capacity ? "font-semibold text-amber-800" : "text-slate-600"}`}>
          {selected.length ? `${selected.length} ligas seleccionadas: ${matchesPerRound} partidos por jornada. Capacidad base: ${capacity} espacios por fecha; los bloqueos de cancha pueden reducirla.` : "Selecciona al menos una liga para continuar."}
        </p>
      </fieldset>
      <fieldset className="border-t border-slate-200 pt-5">
        <legend className="pr-3 text-base font-bold text-[#102d50]">2. Revisa las fechas</legend>
        <p className="mb-4 text-sm text-slate-600">Puedes ajustar la fecha de cada jornada antes de generar la propuesta.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {values.map((date, index) => (
            <label key={index} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="mb-2 flex items-center gap-2 text-xs font-bold text-[#102d50]"><CalendarDays className="h-4 w-4" aria-hidden />Jornada {fromRound + index}</span>
              <input type="date" name="dates" required value={date} className={inputClass}
                onChange={(event) => setValues((previous) => previous.map((value, i) => i === index ? event.target.value : value))} />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="flex max-w-2xl items-start gap-2 text-sm leading-relaxed text-blue-950"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />Primero verás una propuesta con los cruces, horarios y canchas. El calendario se guarda cuando la confirmas.</p>
        <fieldset disabled={selected.length === 0}><SubmitButton>Generar propuesta</SubmitButton></fieldset>
      </div>
    </ActionForm>
  );
}

export function DraftActions({
  draftId,
  canConfirm = true,
  confirm,
  discard,
  regenerate,
}: {
  draftId: string;
  canConfirm?: boolean;
  confirm: ServerAction;
  discard: ServerAction;
  regenerate: ServerAction;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-start gap-2">
      <ActionForm action={regenerate}>
        <SubmitButton variant="secondary">Regenerar propuesta</SubmitButton>
      </ActionForm>
      <ConfirmAction action={discard} hidden={{ draftId }} label="Descartar propuesta" title="Descartar esta propuesta" description="Se descartará la propuesta provisional. Las jornadas que ya estaban confirmadas se conservan." confirmLabel="Descartar propuesta" size="md" />
      {canConfirm && <ActionForm action={confirm} confirmLabel="Acepto las advertencias y confirmo" refresh={false} onSuccess={() => router.push("/calendario?seccion=jornadas")}>
        <input type="hidden" name="draftId" value={draftId} />
        <SubmitButton>Confirmar calendario</SubmitButton>
      </ActionForm>}
    </div>
  );
}

export function RoundAdminButtons({
  roundId,
  number,
  date,
  locked,
  lockAction,
  dateAction,
}: {
  roundId: string;
  number: number;
  date: string;
  locked: boolean;
  lockAction: ServerAction;
  dateAction: ServerAction;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <ModalButton label="Cambiar fecha" title={`Cambiar fecha de la jornada ${number}`} variant="secondary" size="sm">
        {(close) => (
          <ActionForm action={dateAction} onSuccess={close} className="space-y-3">
            <input type="hidden" name="roundId" value={roundId} />
            <p className="text-sm text-zinc-600">Se moverán los partidos no cancelados que todavía usan la fecha de la jornada. Si hay resultados registrados, cambia la fecha desde cada partido.</p>
            <TextField name="date" type="date" label="Nueva fecha" required defaultValue={date} />
            <TextArea name="reason" label="Motivo" required />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>Cancelar</Button>
              <SubmitButton>Guardar</SubmitButton>
            </div>
          </ActionForm>
        )}
      </ModalButton>
      <ModalButton label={locked ? "Desbloquear" : "Proteger"} title={`${locked ? "Desbloquear" : "Proteger"} jornada ${number}`} variant={locked ? "danger" : "secondary"} size="sm">
        {(close) => (
          <ActionForm action={lockAction} onSuccess={close} className="space-y-3">
            <input type="hidden" name="roundId" value={roundId} />
            <input type="hidden" name="locked" value={locked ? "0" : "1"} />
            <p className="text-sm text-zinc-600">
              {locked
                ? "Al desbloquear, los partidos de la jornada podrán modificarse o regenerarse. Cada cambio queda en el historial."
                : "Proteger la jornada exige indicar un motivo para cualquier cambio posterior."}
            </p>
            <TextArea name="reason" label="Motivo" required />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>Cancelar</Button>
              <SubmitButton variant={locked ? "dark" : "primary"}>{locked ? "Desbloquear" : "Proteger"}</SubmitButton>
            </div>
          </ActionForm>
        )}
      </ModalButton>
    </div>
  );
}
