"use client";

import { Plus } from "lucide-react";
import { ActionForm, ModalButton, SelectField, SubmitButton, TextField, type ServerAction } from "@/components/ui/form";
import { Button } from "@/components/ui/core";
import { ROLE } from "@/lib/labels";

export function UserCreateButton({ action }: { action: ServerAction }) {
  return (
    <ModalButton label="Nuevo usuario" title="Crear usuario" icon={<Plus className="h-4 w-4" />}>
      {(close) => (
        <ActionForm action={action} onSuccess={close} className="space-y-3">
          <TextField name="name" label="Nombre" required maxLength={80} />
          <TextField name="email" label="Correo" type="email" required autoComplete="off" />
          <SelectField name="role" label="Rol" options={Object.entries(ROLE).map(([value, label]) => ({ value, label }))} defaultValue="ADMIN" />
          <TextField name="password" label="Contraseña inicial" type="password" required autoComplete="new-password" hint="(mín. 10, letras y números)" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancelar</Button>
            <SubmitButton>Crear</SubmitButton>
          </div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function ResetPasswordButton({ action, userId, name }: { action: ServerAction; userId: string; name: string }) {
  return (
    <ModalButton label="Contraseña" title={`Restablecer contraseña de ${name}`} variant="secondary" size="sm">
      {(close) => (
        <ActionForm action={action} onSuccess={close} className="space-y-3">
          <input type="hidden" name="id" value={userId} />
          <TextField name="password" label="Nueva contraseña" type="password" required autoComplete="new-password" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancelar</Button>
            <SubmitButton>Guardar</SubmitButton>
          </div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function OwnPasswordForm({ action }: { action: ServerAction }) {
  return (
    <ActionForm action={action} resetOnSuccess className="grid gap-3 sm:grid-cols-3 sm:items-end">
      <TextField name="current" label="Actual" type="password" required autoComplete="current-password" />
      <TextField name="next" label="Nueva" type="password" required autoComplete="new-password" />
      <TextField name="confirmNext" label="Confirmar" type="password" required autoComplete="new-password" />
      <div className="sm:col-span-3 flex justify-end">
        <SubmitButton>Cambiar contraseña</SubmitButton>
      </div>
    </ActionForm>
  );
}
