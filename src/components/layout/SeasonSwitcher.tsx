"use client";

import { useTransition } from "react";
import { selectSeasonAction } from "@/server/actions/season";

export function SeasonSwitcher({ seasons, current }: { seasons: { id: string; name: string; isCurrent: boolean }[]; current: string }) {
  const [pending, start] = useTransition();
  return (
    <label className="flex min-w-0 items-center gap-2 text-xs text-zinc-600">
      <span className="hidden font-semibold sm:inline">Temporada:</span>
      <select
        aria-label="Temporada seleccionada"
        defaultValue={current}
        disabled={pending}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("seasonId", e.target.value);
          start(() => selectSeasonAction(fd));
        }}
        className="min-h-10 min-w-0 max-w-[14rem] truncate rounded-lg border border-slate-400 bg-white py-1.5 pr-8 pl-2 text-xs font-semibold text-slate-800 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700"
      >
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.isCurrent ? " (vigente)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
