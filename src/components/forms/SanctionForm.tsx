"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ActionForm, ModalButton, SelectField, SubmitButton, TextArea, TextField, type ServerAction } from "@/components/ui/form";
import { Button, inputClass } from "@/components/ui/core";
import { SANCTION_STATUS } from "@/lib/labels";

type Opt = { value: string; label: string };
export interface SanctionFormData {
  teams: { id: string; name: string; players: { id: string; fullName: string }[] }[];
  matches: { id: string; label: string; teamIds: string[] }[];
  types: Opt[];
  units: (Opt & { kind: string })[];
}

const statusOpts = Object.entries(SANCTION_STATUS).map(([value, v]) => ({ value, label: v.label }));

function Fields({ data, initial, fixedPlayer }: { data: SanctionFormData; initial?: Partial<Record<string, string>>; fixedPlayer?: { teamId: string; playerId: string } }) {
  const [teamId, setTeamId] = useState(fixedPlayer?.teamId ?? initial?.teamId ?? "");
  const [unit, setUnit] = useState(initial?.unitId ?? data.units[0]?.value ?? "");
  const players = data.teams.find((t) => t.id === teamId)?.players ?? [];
  const matches = useMemo(() => data.matches.filter((m) => !teamId || m.teamIds.includes(teamId)), [data.matches, teamId]);
  const unitKind = data.units.find((u) => u.value === unit)?.kind;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {!fixedPlayer ? (
        <>
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700" htmlFor="sf-team">Equipo <span className="text-brand-700">*</span></label>
            <select id="sf-team" value={teamId} onChange={(e) => setTeamId(e.target.value)} className={inputClass} required>
              <option value="">Selecciona…</option>
              {data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <SelectField name="playerId" label="Jugador" required options={players.map((p) => ({ value: p.id, label: p.fullName }))} placeholder={teamId ? "Selecciona…" : "Primero elige equipo"} />
        </>
      ) : (
        <input type="hidden" name="playerId" value={fixedPlayer.playerId} />
      )}
      <SelectField name="matchId" label="Partido relacionado" hint="(opcional)" options={matches.map((m) => ({ value: m.id, label: m.label }))} placeholder="Sin partido" defaultValue={initial?.matchId} className="sm:col-span-2" />
      <TextField name="date" type="date" label="Fecha" required defaultValue={initial?.date ?? new Date().toISOString().slice(0, 10)} />
      <SelectField name="typeId" label="Tipo de sanción" required options={data.types} defaultValue={initial?.typeId} placeholder="Selecciona…" />
      <TextField name="duration" type="number" min={0} max={10000} label="Duración" required defaultValue={initial?.duration ?? "1"} />
      <div>
        <label className="mb-1 block text-xs font-semibold text-zinc-700" htmlFor="sf-unit">Unidad <span className="text-brand-700">*</span></label>
        <select id="sf-unit" name="unitId" value={unit} onChange={(e) => setUnit(e.target.value)} className={inputClass} required>
          {data.units.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>
        <p className="mt-1 text-[11px] text-zinc-500">
          {unitKind === "PARTIDOS" ? "Se llevará el control de los partidos cumplidos." : "Se conserva la duración exacta; no se convierte a partidos."}
        </p>
      </div>
      <SelectField name="status" label="Estado" required options={statusOpts} defaultValue={initial?.status ?? "ACTIVA"} />
      <TextArea name="reason" label="Motivo" required defaultValue={initial?.reason} className="sm:col-span-2" />
      <TextArea name="notes" label="Observaciones" defaultValue={initial?.notes} className="sm:col-span-2" />
    </div>
  );
}

export function SanctionCreateButton({ action, data }: { action: ServerAction<{ id: string }>; data: SanctionFormData }) {
  const router = useRouter();
  return (
    <ModalButton label="Nueva sanción" title="Registrar sanción" icon={<Plus className="h-4 w-4" />} wide>
      {(close) => (
        <ActionForm
          action={action}
          onSuccess={(r) => {
            close();
            if (r.data?.id) router.push(`/sanciones/${r.data.id}`);
          }}
        >
          <Fields data={data} />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancelar</Button>
            <SubmitButton>Registrar sanción</SubmitButton>
          </div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function SanctionEditForm({ action, data, sanction }: { action: ServerAction; data: SanctionFormData; sanction: Record<string, string> & { id: string; playerId: string; teamId: string } }) {
  return (
    <ActionForm action={action}>
      <input type="hidden" name="id" value={sanction.id} />
      <Fields data={data} initial={sanction} fixedPlayer={{ teamId: sanction.teamId, playerId: sanction.playerId }} />
      <TextArea name="changeReason" label="Motivo del cambio" required className="mt-3" placeholder="Se registrará en el historial" />
      <div className="mt-4 flex justify-end">
        <SubmitButton>Guardar cambios</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ServingForm({ action, sanctionId, matches }: { action: ServerAction; sanctionId: string; matches: Opt[] }) {
  return (
    <ActionForm action={action} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_10rem_1fr_auto] sm:items-end">
      <input type="hidden" name="sanctionId" value={sanctionId} />
      <SelectField name="matchId" label="Partido cumplido" options={matches} placeholder="Sin partido (indica fecha)" />
      <TextField name="date" type="date" label="o fecha" />
      <TextField name="notes" label="Nota" maxLength={300} />
      <SubmitButton>Registrar cumplimiento</SubmitButton>
    </ActionForm>
  );
}
