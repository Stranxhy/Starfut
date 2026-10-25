"use client";

import { useState } from "react";
import { ActionForm, SubmitButton, type ServerAction } from "@/components/ui/form";

export interface FillPair {
  home: string;
  away: string;
  homeName: string;
  awayName: string;
  homeLeague: string;
  awayLeague: string;
  crossLeague: boolean;
  previousMeetings: number;
  timeSlotId: string | null;
  startTime: string | null;
  fieldId: string | null;
  fieldName: string | null;
}

export function FillDayForm({ action, date, pairs, friendly }: { action: ServerAction; date: string; pairs: FillPair[]; friendly?: boolean }) {
  const [selected, setSelected] = useState(() => pairs.map(() => true));
  const chosen = pairs.filter((_, i) => selected[i]);
  return (
    <ActionForm action={action} className="space-y-4">
      <input type="hidden" name="date" value={date} />
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          chosen.map((p) => ({ home: p.home, away: p.away, timeSlotId: p.timeSlotId, fieldId: p.fieldId, crossLeague: p.crossLeague })),
        )}
      />
      <ul className="divide-y divide-zinc-100 rounded-xl ring-1 ring-zinc-200">
        {pairs.map((p, i) => (
          <li key={`${p.home}-${p.away}`}>
            <label className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-zinc-50">
              <input
                type="checkbox"
                checked={selected[i]}
                onChange={(e) => setSelected((s) => s.map((v, j) => (j === i ? e.target.checked : v)))}
                className="h-4 w-4 accent-brand-700"
              />
              <span className="min-w-56 flex-1 font-semibold text-zinc-900">
                {p.homeName} <span className="font-normal text-zinc-400">vs</span> {p.awayName}
                {p.crossLeague && (
                  <span className="ml-2 rounded-full bg-fuchsia-100 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-900 ring-1 ring-fuchsia-300">
                    {p.homeLeague} + {p.awayLeague}
                  </span>
                )}
              </span>
              <span className="text-sm text-zinc-600 tabular-nums">
                {p.startTime ? `${p.startTime} · ${p.fieldName}` : <span className="text-red-700">Sin espacio libre</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-sm text-zinc-600">
        {friendly
          ? "La fase regular ya terminó: estos partidos se registran como amistosos y no cuentan para la tabla. Solo cuentan los partidos de eliminatoria."
          : "Todos los partidos cuentan para la tabla; en los combinados, cada equipo suma en la tabla de su liga."}
      </p>
      <div className="flex justify-end">
        <SubmitButton>
          Crear {chosen.length} partido{chosen.length === 1 ? "" : "s"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
