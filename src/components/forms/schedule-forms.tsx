"use client";

import { useState } from "react";
import { ActionForm, CheckboxField, ModalButton, SubmitButton, TextArea, TextField, type ServerAction } from "@/components/ui/form";
import { Button } from "@/components/ui/core";

export function GeneratorForm({
  action,
  fromRound,
  dates,
  leagues,
}: {
  action: ServerAction;
  fromRound: number;
  dates: string[];
  leagues: { id: string; name: string; teams: number }[];
}) {
  const [values, setValues] = useState(dates);
  return (
    <ActionForm action={action} className="space-y-4">
      <input type="hidden" name="fromRound" value={fromRound} />
      <fieldset>
        <legend className="mb-2 text-xs font-semibold text-zinc-700">Ligas a programar</legend>
        <div className="flex flex-wrap gap-4">
          {leagues.map((l) => (
            <CheckboxField key={l.id} name="leagueIds" value={l.id} defaultChecked label={`${l.name} (${l.teams} equipos activos)`} />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-xs font-semibold text-zinc-700">
          Fechas de juego (jornadas {fromRound}–{fromRound + values.length - 1})
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {values.map((d, i) => (
            <label key={i} className="text-xs">
              <span className="mb-0.5 block font-semibold text-zinc-600">Jornada {fromRound + i}</span>
              <input
                type="date"
                name="dates"
                required
                value={d}
                onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                className="block w-full rounded-lg border-0 px-2 py-1.5 text-sm ring-1 ring-zinc-300 focus:ring-2 focus:ring-brand-600"
              />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <p className="mr-auto text-xs text-zinc-500">Se generará una vista previa. Nada se guarda en el calendario hasta que la confirmes.</p>
        <SubmitButton>Generar vista previa</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DraftActions({
  draftId,
  confirm,
  discard,
  regenerate,
}: {
  draftId: string;
  confirm: ServerAction;
  discard: ServerAction;
  regenerate: ServerAction;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <ActionForm action={regenerate}>
        <SubmitButton variant="secondary">Regenerar propuesta</SubmitButton>
      </ActionForm>
      <ActionForm action={discard}>
        <input type="hidden" name="draftId" value={draftId} />
        <SubmitButton variant="danger">Descartar</SubmitButton>
      </ActionForm>
      <ActionForm action={confirm} confirmLabel="Acepto las advertencias y confirmo">
        <input type="hidden" name="draftId" value={draftId} />
        <SubmitButton>Confirmar calendario</SubmitButton>
      </ActionForm>
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
            <p className="text-sm text-zinc-600">Todos los partidos no cancelados de la jornada se moverán a la nueva fecha y quedarán como reprogramados.</p>
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
