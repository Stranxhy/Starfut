"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ActionForm, ModalButton, SelectField, SubmitButton, TextArea, TextField, type ServerAction } from "@/components/ui/form";
import { Button } from "@/components/ui/core";
import { SANCTION_STATUS } from "@/lib/labels";

type Opt = { value: string; label: string };
export interface SanctionFormData {
  today: string;
  teams: { id: string; name: string; active: boolean; leagueId: string; leagueName: string; players: { id: string; fullName: string }[] }[];
  matches: { id: string; label: string; teamIds: string[] }[];
  filterTypes: Opt[];
  types: Opt[];
  units: (Opt & { kind: string })[];
}

const statusOpts = Object.entries(SANCTION_STATUS).map(([value, valueInfo]) => ({ value, label: valueInfo.label }));

function Fields({ data, initial, fixedPlayer }: { data: SanctionFormData; initial?: Partial<Record<string, string>>; fixedPlayer?: { teamId: string; playerId: string } }) {
  const [teamId, setTeamId] = useState(fixedPlayer?.teamId ?? initial?.teamId ?? "");
  const [unit, setUnit] = useState(initial?.unitId ?? data.units[0]?.value ?? "");
  const players = data.teams.find((team) => team.id === teamId)?.players ?? [];
  const matches = data.matches.filter((match) => !teamId || match.teamIds.includes(teamId) || match.id === initial?.matchId);
  const unitKind = data.units.find((option) => option.value === unit)?.kind;
  return <div className="space-y-5">
    <fieldset className="min-w-0 rounded-xl border border-slate-200 p-4">
      <legend className="px-2 text-sm font-bold text-[#102d50]">Participante y fecha</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        {!fixedPlayer ? <>
          <SelectField name="teamSelection" label="Equipo del jugador" value={teamId} onChange={(event) => setTeamId(event.target.value)} required placeholder="Selecciona un equipo"
            options={data.teams.map((team) => ({ value: team.id, label: `${team.name} (${team.leagueName})${team.active ? "" : " · Baja"}` }))} />
          <SelectField key={teamId} name="playerId" label="Jugador" required disabled={!teamId} options={players.map((player) => ({ value: player.id, label: player.fullName }))} placeholder={!teamId ? "Primero elige un equipo" : players.length ? "Selecciona un jugador" : "Sin jugadores activos"} />
        </> : <input type="hidden" name="playerId" value={fixedPlayer.playerId} />}
        <SelectField key={`match-${teamId}`} name="matchId" label="Partido relacionado" hint="(opcional)" options={matches.map((match) => ({ value: match.id, label: match.label }))} placeholder="Sin partido relacionado" defaultValue={initial?.matchId} className="min-w-0 sm:col-span-2" />
        <TextField name="date" type="date" label="Fecha de la sanción" required defaultValue={initial?.date ?? data.today} />
      </div>
    </fieldset>
    <fieldset className="min-w-0 rounded-xl border border-slate-200 p-4">
      <legend className="px-2 text-sm font-bold text-[#102d50]">Detalle de la sanción</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="typeId" label="Tipo de sanción" required options={data.types} defaultValue={initial?.typeId} placeholder="Selecciona un tipo" />
        <SelectField name="status" label="Estado" required options={statusOpts} defaultValue={initial?.status ?? "ACTIVA"} />
        <TextField name="duration" type="number" min={0} max={10000} label="Duración" required defaultValue={initial?.duration ?? "1"} />
        <SelectField name="unitId" label="Unidad de duración" value={unit} onChange={(event) => setUnit(event.target.value)} required options={data.units} />
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-900 sm:col-span-2">
          {unitKind === "PARTIDOS" ? "Registra los partidos cumplidos en la ficha. El estado En revisión se conserva hasta que lo actualices." : "El seguimiento de esta unidad es manual: conserva la duración original y actualiza el estado al completar la sanción."}
        </p>
        <TextArea name="reason" label="Motivo de la sanción" required maxLength={500} rows={3} defaultValue={initial?.reason} className="sm:col-span-2" />
        <TextArea name="notes" label="Observaciones" hint="(opcional)" maxLength={1000} rows={3} defaultValue={initial?.notes} className="sm:col-span-2" />
      </div>
    </fieldset>
  </div>;
}

export function SanctionCreateButton({ action, data }: { action: ServerAction<{ id: string }>; data: SanctionFormData }) {
  const router = useRouter();
  return <ModalButton label="Nueva sanción" title="Registrar sanción" description="Selecciona al jugador y explica el motivo y la duración de la sanción." icon={<Plus className="h-4 w-4" />} wide>
    {(close) => <ActionForm action={action} onSuccess={(result) => { close(); if (result.data?.id) router.push(`/sanciones/${result.data.id}`); }}>
      <Fields data={data} />
      <div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={close}>Cancelar</Button><SubmitButton>Registrar sanción</SubmitButton></div>
    </ActionForm>}
  </ModalButton>;
}

export function SanctionEditForm({ action, data, sanction }: { action: ServerAction; data: SanctionFormData; sanction: Record<string, string> & { id: string; playerId: string; teamId: string } }) {
  return <ActionForm action={action}>
    <input type="hidden" name="id" value={sanction.id} />
    <Fields data={data} initial={sanction} fixedPlayer={{ teamId: sanction.teamId, playerId: sanction.playerId }} />
    <TextArea name="changeReason" label="Motivo del cambio" required maxLength={300} className="mt-4" placeholder="Explica qué estás corrigiendo; quedará en el historial" />
    <div className="mt-4 flex justify-end"><SubmitButton>Guardar cambios</SubmitButton></div>
  </ActionForm>;
}

export function ServingForm({ action, sanctionId, matches }: { action: ServerAction; sanctionId: string; matches: Opt[] }) {
  return <ActionForm action={action} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
    <input type="hidden" name="sanctionId" value={sanctionId} />
    <SelectField name="matchId" label="Partido cumplido" options={matches} placeholder="Registrar por fecha, sin partido" className="min-w-0 sm:col-span-2" />
    <TextField name="date" type="date" label="Fecha si no eliges partido" />
    <TextField name="notes" label="Nota" hint="(opcional)" maxLength={300} />
    <p className="text-xs leading-relaxed text-slate-600 sm:col-span-2">Si eliges un partido, se usará su fecha. De lo contrario, indica la fecha del cumplimiento.</p>
    <div className="sm:col-span-2"><SubmitButton>Registrar cumplimiento</SubmitButton></div>
  </ActionForm>;
}
