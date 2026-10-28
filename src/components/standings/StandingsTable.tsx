import Link from "next/link";
import { MoveHorizontal } from "lucide-react";
import type { StandingRow } from "@/domain/standings";
import type { Zone } from "@/domain/bracket";
import { STANDING_ABBR } from "@/lib/labels";

type Row = StandingRow & { zone: Zone | null };
const columns = [
  { key: "jj", label: "JJ" }, { key: "jg", label: "JG" }, { key: "jp", label: "JP" },
  { key: "eg", label: "EG" }, { key: "ep", label: "EP" }, { key: "e", label: "E" },
  { key: "gf", label: "GF" }, { key: "ge", label: "GE" }, { key: "dif", label: "DIF" },
] as const;

export function StandingsTable({ rows, caption, hasResults }: { rows: Row[]; caption: string; hasResults: boolean }) {
  const visibleColumns = columns.filter((column) => column.key !== "e" || rows.some((row) => row.e > 0));
  return <>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-xs text-slate-600 sm:px-5">
      <p>{rows.length} {rows.length === 1 ? "equipo" : "equipos"} · Abre un equipo para ver su ficha.</p>
      <p id="tabla-desplazamiento" className="inline-flex items-center gap-1.5"><MoveHorizontal className="h-4 w-4 shrink-0" aria-hidden />Desliza para ver todas las estadísticas.</p>
    </div>
    <div role="region" aria-label="Clasificación por equipo" aria-describedby="tabla-desplazamiento" tabIndex={0}
      className="scroll-thin overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700">
      <table className="w-full min-w-[56rem] table-fixed border-collapse text-sm">
        <caption className="sr-only">{caption}. Las zonas de clasificación se indican junto al nombre de cada equipo.</caption>
        <colgroup><col className="w-44 sm:w-64" /><col className="w-20" />{visibleColumns.map((column) => <col key={column.key} />)}</colgroup>
        <thead>
          <tr className="border-b border-slate-300 bg-slate-100 text-xs font-bold text-slate-600">
            <th scope="col" className="sticky left-0 z-10 bg-slate-100 px-4 py-4 text-left"><span className="mr-4">Pos.</span>Equipo</th>
            <th scope="col" className="bg-[#102d50] px-2 py-4 text-center text-white">Puntos</th>
            {visibleColumns.map((column) => <th scope="col" key={column.key} className="px-2 py-4 text-center"><abbr title={STANDING_ABBR[column.label]} aria-label={STANDING_ABBR[column.label]} className="cursor-help decoration-slate-400 decoration-dotted underline-offset-4">{column.label}</abbr></th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const background = index % 2 ? "bg-slate-50" : "bg-white";
            const unresolved = hasResults && row.unresolvedTieGroup !== null;
            return <tr key={row.teamId} className={`group border-b border-slate-200 last:border-b-0 ${background} hover:bg-blue-50/60`}>
              <th scope="row" className={`sticky left-0 z-10 border-l-4 p-3 text-left font-normal ${background} group-hover:bg-blue-50`} style={{ borderLeftColor: row.zone?.color ?? "transparent" }}>
                <div className="flex items-start gap-3">
                  <span className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-300 bg-white text-sm font-bold text-[#102d50] tabular-nums"><span className="sr-only">Posición </span>{row.position}</span>
                  <div className="min-w-0 pt-1">
                    <Link href={`/equipos/${row.teamId}`} className="rounded font-bold break-words text-[#102d50] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">{row.teamName}</Link>
                    {row.zone && <p className="mt-1 text-[11px] leading-relaxed font-medium text-slate-600">{row.zone.label}</p>}
                    {unresolved && <p className="mt-1 text-[11px] font-semibold text-amber-800">Desempate pendiente</p>}
                  </div>
                </div>
              </th>
              <td className="bg-blue-50 px-2 py-4 text-center text-xl font-extrabold text-[#102d50] tabular-nums">{row.pts}</td>
              {visibleColumns.map((column) => <td key={column.key} className={`px-2 py-4 text-center tabular-nums ${column.key === "dif" ? "font-bold text-[#102d50]" : "text-slate-700"}`}>
                {column.key === "dif" && row.dif > 0 ? `+${row.dif}` : row[column.key]}
              </td>)}
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </>;
}
