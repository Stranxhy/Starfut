import { Badge } from "@/components/ui/core";

export function LeagueStatus({ active }: { active: boolean }) {
  return <Badge className={active ? "bg-emerald-50 text-emerald-900 ring-emerald-300" : "bg-slate-100 text-slate-600 ring-slate-300"}>{active ? "Activa" : "Inactiva"}</Badge>;
}

export function LeaguePhase({ hasChampion, hasSnapshot }: { hasChampion: boolean; hasSnapshot: boolean }) {
  return <Badge className={hasChampion ? "bg-amber-50 text-amber-900 ring-amber-300" : hasSnapshot ? "bg-blue-50 text-blue-900 ring-blue-200" : "bg-slate-50 text-slate-700 ring-slate-300"}>
    {hasChampion ? "Campeón definido" : hasSnapshot ? "Eliminatorias" : "Fase regular"}
  </Badge>;
}
