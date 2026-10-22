"use client";

import { ActionForm, SelectField, SubmitButton, TextField, type ServerAction } from "@/components/ui/form";

export function RestrictionForm({ action, teamId, slots }: { action: ServerAction; teamId: string; slots: { value: string; label: string }[] }) {
  return (
    <ActionForm action={action} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[10rem_9rem_1fr_auto] lg:items-end">
      <input type="hidden" name="teamId" value={teamId} />
      <TextField name="date" type="date" label="Fecha" hint="(vacía = todas)" />
      <SelectField name="timeSlotId" label="Horario" options={slots} placeholder="Todo el día" />
      <TextField name="reason" label="Motivo" maxLength={200} />
      <SubmitButton>Agregar</SubmitButton>
    </ActionForm>
  );
}
