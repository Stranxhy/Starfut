import Link from "next/link";
import type { ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { buttonClass, inputClass } from "./core";
import { removeFilter, type FilterParams } from "@/domain/filters";

export type FilterChip = { name: string; label: string; value?: string; resetValue?: string };
export const filterGrid = "grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-4";

export function FilterField({ name, label, children }: { name: string; label: string; children: ReactNode }) {
  return <div className="min-w-0"><label htmlFor={name} className="mb-2 block text-sm font-semibold text-slate-700">{label}</label>{children}</div>;
}

export function FilterSelect({ name, label, value, options, all = "Todos" }: {
  name: string; label: string; value?: string; options: { value: string; label: string }[]; all?: string | false;
}) {
  return (
    <FilterField name={name} label={label}>
      <select id={name} name={name} defaultValue={value ?? ""} className={inputClass}>
        {all !== false && <option value="">{all}</option>}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </FilterField>
  );
}

export function FilterPanel({ path, params, chips, total, children, advanced, advancedOpen, preserve }: {
  path: string; params: FilterParams; chips: FilterChip[]; total: number; children: ReactNode;
  advanced?: ReactNode; advancedOpen?: boolean; preserve?: string[];
}) {
  const active = chips.filter((chip) => chip.value);
  return (
    <div className="border-b border-slate-200 bg-slate-50/80">
      <form action={path} method="get" role="search" aria-label="Filtrar registros" className="px-4 py-5 sm:px-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-bold text-[#102d50]">
          <SlidersHorizontal className="h-4 w-4" aria-hidden />Buscar y filtrar
        </div>
        {preserve?.map((name) => params[name] !== undefined && <input key={name} type="hidden" name={name} value={params[name]} />)}
        <div className={filterGrid}>{children}</div>
        {advanced && (
          <details className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-3" open={advancedOpen || undefined}>
            <summary className="cursor-pointer text-sm font-semibold text-blue-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">Más filtros</summary>
            <div className={`${filterGrid} mt-4`}>{advanced}</div>
          </details>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className={buttonClass("primary")} type="submit">Aplicar filtros</button>
          <Link href={path} className={buttonClass("secondary")}>Restablecer</Link>
          <span className="text-sm text-slate-600 sm:ml-auto">{total.toLocaleString("es-MX")} {total === 1 ? "resultado" : "resultados"}</span>
        </div>
      </form>
      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-5" aria-label="Filtros aplicados">
          <span className="mr-1 text-xs font-semibold text-slate-600">Aplicados:</span>
          {active.map((chip) => (
            <Link key={chip.name} href={removeFilter(path, params, chip.name, chip.resetValue)} aria-label={`Quitar filtro ${chip.label}: ${chip.value}`}
              className="inline-flex min-h-8 max-w-full items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-900 hover:border-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
              <span className="break-words">{chip.label}: {chip.value}</span><X className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function LeagueTabs({ path, leagues, selected, params = {} }: {
  path: string; leagues: { id: string; name: string }[]; selected: string; params?: FilterParams;
}) {
  return (
    <nav aria-label="Elegir liga" className="mb-4 flex flex-wrap gap-2">
      {leagues.map((league) => {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries({ ...params, liga: league.id })) if (value !== undefined && value !== "") query.set(key, String(value));
        return <Link key={league.id} href={`${path}?${query}`} aria-current={league.id === selected ? "page" : undefined}
          className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${league.id === selected ? "border-[#102d50] bg-[#102d50] text-white" : "border-slate-300 bg-white text-slate-700 hover:border-blue-700 hover:bg-blue-50"}`}>{league.name}</Link>;
      })}
    </nav>
  );
}
