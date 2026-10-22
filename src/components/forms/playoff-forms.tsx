"use client";

import { ActionForm, CheckboxField, SubmitButton, TextArea, TextField, type ServerAction } from "@/components/ui/form";
import { inputClass } from "@/components/ui/core";

export function CloseRegularPhaseForm({
  action,
  leagueId,
  hasIssues,
  groups,
}: {
  action: ServerAction;
  leagueId: string;
  hasIssues: boolean;
  groups: { index: number; positions: number[]; teams: { id: string; name: string }[] }[];
}) {
  return (
    <ActionForm action={action} confirmLabel="Cerrar con clasificación incompleta" className="space-y-4">
      <input type="hidden" name="leagueId" value={leagueId} />
      {groups.map((g) => (
        <fieldset key={g.index} className="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
          <legend className="px-1 text-sm font-semibold text-amber-900">Decisión oficial: orden para las posiciones {g.positions.join(", ")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {g.positions.map((pos, i) => (
              <label key={pos} className="text-xs">
                <span className="mb-0.5 block font-semibold">Posición {pos}</span>
                <select name={`order[${g.index}][${i}]`} required className={inputClass} defaultValue={g.teams[i]?.id}>
                  {g.teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {hasIssues && (
        <CheckboxField
          name="acceptPending"
          label="Autorizo cerrar la fase regular aunque existan partidos pendientes o cancelados"
          hint="Esta autorización quedará registrada en el historial."
        />
      )}
      <TextArea name="notes" label={groups.length ? "Decisión oficial / observaciones (obligatorio)" : "Observaciones"} required={groups.length > 0} />
      <div className="flex justify-end">
        <SubmitButton>Cerrar fase regular y congelar clasificación</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function GenerateStageForm({ action, stageId, defaultDate, label }: { action: ServerAction; stageId: string; defaultDate: string; label: string }) {
  return (
    <ActionForm action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="stageId" value={stageId} />
      <TextField name="date" type="date" label="Fecha confirmada" required defaultValue={defaultDate} />
      <SubmitButton size="sm">{label}</SubmitButton>
    </ActionForm>
  );
}
