import Link from "next/link";
import type { SanctionStatusCode, SanctionUnitKindCode } from "@/domain/sanctions";
import { Badge } from "@/components/ui/core";
import { formatShort } from "@/lib/dates";
import { SANCTION_STATUS } from "@/lib/labels";
import { SanctionProgress } from "./SanctionProgress";

type DirectorySanction = {
  id: string; date: Date; reason: string; duration: number; status: SanctionStatusCode;
  player: { id: string; fullName: string };
  team: { id: string; name: string; active: boolean; league: { name: string } };
  type: { name: string }; unit: { name: string; kind: SanctionUnitKindCode };
  _count: { servings: number };
};
const linkClass = "rounded hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

export function SanctionsDirectory({ sanctions }: { sanctions: DirectorySanction[] }) {
  return <ul aria-label="Sanciones encontradas" className="divide-y divide-slate-200">
    {sanctions.map((sanction, index) => <li key={sanction.id} className={`grid gap-4 px-4 py-5 sm:px-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-6 ${index % 2 ? "bg-slate-50" : "bg-white"}`}>
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2"><span className="text-xs text-slate-600">{formatShort(sanction.date)}</span><Badge className={SANCTION_STATUS[sanction.status].className}>{SANCTION_STATUS[sanction.status].label}</Badge></div>
        <Link href={`/sanciones/${sanction.id}`} className={`${linkClass} text-base font-bold break-words text-[#102d50]`}>{sanction.player.fullName}</Link>
        <p className="mt-1 text-sm font-semibold break-words text-slate-700">{sanction.type.name}</p>
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-line break-words text-slate-600">{sanction.reason}</p>
      </div>
      <div className="min-w-0">
        <p className="mb-1 text-xs font-semibold text-slate-600">Equipo de la sanción</p>
        <Link href={`/equipos/${sanction.team.id}`} className={`${linkClass} text-sm font-semibold break-words text-[#102d50]`}>{sanction.team.name}</Link>
        <p className="mt-1 text-xs break-words text-slate-600">{sanction.team.league.name}{!sanction.team.active && " · Equipo dado de baja"}</p>
        <Link href={`/jugadores/${sanction.player.id}`} className={`${linkClass} mt-3 inline-block text-xs font-semibold text-blue-800 underline underline-offset-2`}>Ver ficha del jugador</Link>
      </div>
      <div className="min-w-0 border-t border-slate-200 pt-4 lg:border-t-0 lg:pt-0">
        <p className="mb-2 text-sm font-bold break-words text-[#102d50]">Duración: {sanction.duration} {sanction.unit.name.toLowerCase()}</p>
        <SanctionProgress kind={sanction.unit.kind} duration={sanction.duration} served={sanction._count.servings} status={sanction.status} />
        <Link href={`/sanciones/${sanction.id}`} aria-label={`Ver sanción de ${sanction.player.fullName} del ${formatShort(sanction.date)}`} className={`${linkClass} mt-3 inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#102d50] hover:border-blue-700 hover:bg-blue-50`}>Ver sanción y cumplimiento</Link>
      </div>
    </li>)}
  </ul>;
}
