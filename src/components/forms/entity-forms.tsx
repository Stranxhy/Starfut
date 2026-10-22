"use client";

import { Plus, Upload } from "lucide-react";
import { ActionForm, CheckboxField, ModalButton, SelectField, SubmitButton, TextArea, TextField, type ServerAction } from "@/components/ui/form";
import { Button } from "@/components/ui/core";

type Opt = { value: string; label: string };

// ───────── Ligas ─────────
export function LeagueFormButton({
  action,
  league,
}: {
  action: ServerAction;
  league?: { id: string; name: string; sortOrder: number };
}) {
  return (
    <ModalButton
      label={league ? "Editar" : "Nueva liga"}
      title={league ? `Editar ${league.name}` : "Nueva liga"}
      variant={league ? "secondary" : "primary"}
      size={league ? "sm" : "md"}
      icon={league ? undefined : <Plus className="h-4 w-4" />}
    >
      {(close) => (
        <ActionForm action={action} onSuccess={close} className="space-y-3">
          {league && <input type="hidden" name="id" value={league.id} />}
          <TextField name="name" label="Nombre" required defaultValue={league?.name} maxLength={60} autoFocus />
          <TextField name="sortOrder" label="Orden de presentación" type="number" min={0} max={99} defaultValue={league?.sortOrder ?? 0} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <SubmitButton>Guardar</SubmitButton>
          </div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

// ───────── Equipos ─────────
export interface TeamFormValues {
  id?: string;
  name?: string;
  leagueId?: string;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
}

export function TeamFields({ leagues, team }: { leagues: Opt[]; team?: TeamFormValues }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {team?.id && <input type="hidden" name="id" value={team.id} />}
      <TextField name="name" label="Nombre del equipo" required defaultValue={team?.name} maxLength={60} className="sm:col-span-2" />
      <SelectField name="leagueId" label="Liga" required options={leagues} defaultValue={team?.leagueId ?? leagues[0]?.value} />
      <TextField name="contactName" label="Responsable" hint="(opcional)" defaultValue={team?.contactName ?? ""} maxLength={80} />
      <TextField name="contactPhone" label="Teléfono" hint="(opcional)" defaultValue={team?.contactPhone ?? ""} inputMode="tel" />
      <TextField name="contactEmail" label="Correo" hint="(opcional)" type="email" defaultValue={team?.contactEmail ?? ""} />
      <TextArea name="notes" label="Observaciones" defaultValue={team?.notes ?? ""} className="sm:col-span-2" />
    </div>
  );
}

export function TeamCreateButton({ action, leagues }: { action: ServerAction; leagues: Opt[] }) {
  return (
    <ModalButton label="Nuevo equipo" title="Registrar equipo" icon={<Plus className="h-4 w-4" />} wide>
      {(close) => (
        <ActionForm action={action} onSuccess={close} confirmLabel="Registrar de todos modos">
          <TeamFields leagues={leagues} />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <SubmitButton>Registrar equipo</SubmitButton>
          </div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function TeamEditForm({ action, leagues, team }: { action: ServerAction; leagues: Opt[]; team: TeamFormValues }) {
  return (
    <ActionForm action={action}>
      <TeamFields leagues={leagues} team={team} />
      <div className="mt-4 flex justify-end">
        <SubmitButton>Guardar cambios</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function LogoForm({ action, teamId, hasLogo }: { action: ServerAction; teamId: string; hasLogo: boolean }) {
  return (
    <div className="space-y-2">
      <ActionForm action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={teamId} />
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700" htmlFor={`logo-${teamId}`}>
            Escudo (PNG, JPG o WEBP · máx. 512 KB)
          </label>
          <input id={`logo-${teamId}`} type="file" name="logo" accept="image/png,image/jpeg,image/webp" className="block text-sm" required />
        </div>
        <SubmitButton size="sm" variant="secondary">
          Subir escudo
        </SubmitButton>
      </ActionForm>
      {hasLogo && (
        <ActionForm action={action}>
          <input type="hidden" name="id" value={teamId} />
          <input type="hidden" name="remove" value="1" />
          <SubmitButton size="sm" variant="danger">
            Quitar escudo
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

export function DeactivateTeamButton({ action, teamId, active }: { action: ServerAction; teamId: string; active: boolean }) {
  if (active) {
    return (
      <ModalButton label="Dar de baja" title="Dar de baja al equipo" variant="danger" size="sm">
        {(close) => (
          <ActionForm action={action} onSuccess={close} confirmLabel="Dar de baja de todos modos">
            <input type="hidden" name="id" value={teamId} />
            <input type="hidden" name="active" value="0" />
            <p className="mb-3 text-sm text-zinc-700">
              La baja es lógica: los partidos disputados, goles y sanciones se conservan en el historial. Las jornadas ya disputadas no se regeneran.
            </p>
            <TextArea name="reason" label="Motivo" required />
            <CheckboxField
              name="cancelFuture"
              className="mt-3"
              label="Cancelar sus partidos pendientes"
              hint="Los espacios quedarán libres para programar partidos de sustitución."
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>
                Cancelar
              </Button>
              <SubmitButton variant="dark">Dar de baja</SubmitButton>
            </div>
          </ActionForm>
        )}
      </ModalButton>
    );
  }
  return (
    <ActionForm action={action}>
      <input type="hidden" name="id" value={teamId} />
      <input type="hidden" name="active" value="1" />
      <SubmitButton size="sm" variant="secondary">
        Reactivar equipo
      </SubmitButton>
    </ActionForm>
  );
}

// ───────── Importación CSV ─────────
export function CsvImportButton({
  action,
  title,
  columns,
  example,
  defaultSelect,
}: {
  action: ServerAction;
  title: string;
  columns: string;
  example: string;
  defaultSelect?: { name: string; label: string; options: Opt[] };
}) {
  return (
    <ModalButton label="Importar CSV" title={title} variant="secondary" icon={<Upload className="h-4 w-4" />} wide>
      {(close) => (
        <ActionForm action={action} onSuccess={close} className="space-y-3">
          <p className="text-sm text-zinc-600">
            Columnas: <strong>{columns}</strong>. El encabezado es opcional; se aceptan comas o punto y coma. Los duplicados se omiten.
          </p>
          {defaultSelect && (
            <SelectField name={defaultSelect.name} label={defaultSelect.label} options={defaultSelect.options} placeholder="(usar la columna del archivo)" />
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700" htmlFor="csv-file">
              Archivo .csv
            </label>
            <input id="csv-file" type="file" name="file" accept=".csv,text/csv" className="block text-sm" />
          </div>
          <TextArea name="csv" label="…o pega el contenido" rows={6} placeholder={example} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <SubmitButton>Importar</SubmitButton>
          </div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

// ───────── Jugadores ─────────
export function PlayerCreateButton({ action, teams, defaultTeamId }: { action: ServerAction; teams: { value: string; label: string }[]; defaultTeamId?: string }) {
  return (
    <ModalButton label="Nuevo jugador" title="Registrar jugador" icon={<Plus className="h-4 w-4" />}>
      {(close) => (
        <ActionForm action={action} onSuccess={close} confirmLabel="Registrar de todos modos" className="space-y-3">
          <TextField name="fullName" label="Nombre completo" required maxLength={80} autoFocus />
          <SelectField name="teamId" label="Equipo" required options={teams} defaultValue={defaultTeamId} placeholder="Selecciona…" />
          <TextField name="jerseyNumber" label="Número de camiseta" hint="(opcional)" type="number" min={0} max={999} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <SubmitButton>Registrar</SubmitButton>
          </div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function PlayerEditForm({ action, player }: { action: ServerAction; player: { id: string; fullName: string; jerseyNumber: number | null } }) {
  return (
    <ActionForm action={action} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
      <input type="hidden" name="id" value={player.id} />
      <TextField name="fullName" label="Nombre completo" required defaultValue={player.fullName} maxLength={80} />
      <TextField name="jerseyNumber" label="Camiseta" type="number" min={0} max={999} defaultValue={player.jerseyNumber ?? ""} />
      <SubmitButton>Guardar</SubmitButton>
    </ActionForm>
  );
}

export function TransferPlayerButton({ action, playerId, teams }: { action: ServerAction; playerId: string; teams: Opt[] }) {
  return (
    <ModalButton label="Cambiar de equipo" title="Cambio de equipo" variant="secondary" size="sm">
      {(close) => (
        <ActionForm action={action} onSuccess={close} confirmLabel="Transferir de todos modos" className="space-y-3">
          <input type="hidden" name="id" value={playerId} />
          <p className="text-sm text-zinc-600">
            El historial se conserva: los goles y sanciones ya registrados permanecen asociados al equipo con el que ocurrieron.
          </p>
          <SelectField name="teamId" label="Nuevo equipo" required options={teams} placeholder="Selecciona…" />
          <TextArea name="reason" label="Motivo" required />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <SubmitButton>Confirmar cambio</SubmitButton>
          </div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

// ───────── Árbitros ─────────
export function RefereeFields({ referee }: { referee?: { id: string; name: string; phone: string | null; email: string | null; notes: string | null } }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {referee && <input type="hidden" name="id" value={referee.id} />}
      <TextField name="name" label="Nombre completo" required defaultValue={referee?.name} maxLength={80} className="sm:col-span-2" />
      <TextField name="phone" label="Teléfono" hint="(opcional)" defaultValue={referee?.phone ?? ""} inputMode="tel" />
      <TextField name="email" label="Correo" hint="(opcional)" type="email" defaultValue={referee?.email ?? ""} />
      <TextArea name="notes" label="Observaciones" defaultValue={referee?.notes ?? ""} className="sm:col-span-2" />
    </div>
  );
}

export function RefereeCreateButton({ action }: { action: ServerAction }) {
  return (
    <ModalButton label="Nuevo árbitro" title="Registrar árbitro" icon={<Plus className="h-4 w-4" />}>
      {(close) => (
        <ActionForm action={action} onSuccess={close}>
          <RefereeFields />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <SubmitButton>Registrar</SubmitButton>
          </div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function RefereeEditForm({ action, referee }: { action: ServerAction; referee: { id: string; name: string; phone: string | null; email: string | null; notes: string | null } }) {
  return (
    <ActionForm action={action}>
      <RefereeFields referee={referee} />
      <div className="mt-4 flex justify-end">
        <SubmitButton>Guardar cambios</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function AvailabilityForm({ action, refereeId, slots }: { action: ServerAction; refereeId: string; slots: Opt[] }) {
  return (
    <ActionForm action={action} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[10rem_10rem_10rem_1fr_auto] lg:items-end">
      <input type="hidden" name="refereeId" value={refereeId} />
      <TextField name="date" label="Fecha" type="date" required />
      <SelectField name="timeSlotId" label="Horario" options={slots} placeholder="Todo el día" />
      <SelectField
        name="available"
        label="Disponibilidad"
        options={[
          { value: "0", label: "No disponible" },
          { value: "1", label: "Disponible (confirmado)" },
        ]}
      />
      <TextField name="note" label="Nota" maxLength={200} />
      <SubmitButton>Registrar</SubmitButton>
    </ActionForm>
  );
}

export function SimpleToggleForm({ action, hidden, label, variant = "secondary" }: { action: ServerAction; hidden: Record<string, string>; label: string; variant?: "secondary" | "danger" | "primary" }) {
  return (
    <ActionForm action={action} confirmLabel="Confirmar">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton size="sm" variant={variant}>
        {label}
      </SubmitButton>
    </ActionForm>
  );
}
