"use client";

import { useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { normalizeName } from "@/domain/text";

/** Radios nativos: selección con teclado y envío GET, incluso antes de hidratar. */
export function SearchableFilter({ name, label, value = "", options, all = "Todos" }: {
  name: string; label: string; value?: string; options: { value: string; label: string }[]; all?: string;
}) {
  const id = useId();
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(value);
  const [query, setQuery] = useState("");
  const items = [{ value: "", label: all }, ...options];
  if (selected && !items.some((item) => item.value === selected)) items.push({ value: selected, label: "Selección no disponible" });
  const selectedLabel = items.find((item) => item.value === selected)?.label ?? all;
  const visible = new Set(items.filter((item) => normalizeName(item.label).includes(normalizeName(query))).map((item) => item.value));
  const close = () => {
    if (details.current) details.current.open = false;
    summary.current?.focus();
  };

  return (
    <div className="min-w-0">
      <span id={`${id}-label`} className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <details ref={details} className="group relative" onToggle={(event) => {
        if (event.currentTarget.open) { setQuery(""); search.current?.focus(); }
      }} onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
      }} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }}>
        <summary ref={summary} aria-labelledby={`${id}-label ${id}-value`} className="filter-control flex cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden">
          <span id={`${id}-value`} className="truncate">{selectedLabel}</span>
        </summary>
        <div className="absolute right-0 left-0 z-30 mt-2 rounded-xl border border-slate-300 bg-white p-3 shadow-xl">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-500" aria-hidden />
            <input ref={search} type="search" aria-label={`Buscar en ${label.toLowerCase()}`} placeholder="Escribe para buscar…" autoComplete="off" value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); details.current?.querySelector<HTMLInputElement>('label:not([hidden]) input')?.focus(); } }}
              className="h-10 w-full rounded-md border border-slate-300 py-2 pr-2 pl-9 text-sm focus:outline-2 focus:outline-blue-700" />
          </div>
          <fieldset className="max-h-56 space-y-1 overflow-y-auto overscroll-contain" aria-labelledby={`${id}-label`}>
            <legend className="sr-only">{label}</legend>
            {items.map((item) => (
              <label key={item.value} hidden={!visible.has(item.value)} style={{ display: visible.has(item.value) ? "block" : "none" }} className="cursor-pointer rounded-md px-2 py-2 text-sm text-slate-800 hover:bg-blue-50 focus-within:bg-blue-50">
                <span className="flex items-start gap-2">
                  <input type="radio" name={name} value={item.value} checked={selected === item.value} onChange={() => setSelected(item.value)} onClick={(event) => { if (event.detail > 0) close(); }}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); close(); } }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" />
                  <span className="break-words">{item.label}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {visible.size === 0 && <p role="status" className="py-3 text-sm text-slate-600">No hay opciones con ese nombre.</p>}
          <button type="button" onClick={close} className="mt-2 min-h-9 w-full rounded-md border border-slate-300 text-sm font-semibold text-blue-900 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700">Listo</button>
        </div>
      </details>
    </div>
  );
}
