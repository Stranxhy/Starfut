import { Badge } from "@/components/ui/core";

export function PlayerStatus({ active }: { active: boolean }) {
  return <Badge className={active ? "bg-emerald-50 text-emerald-900 ring-emerald-300" : "bg-slate-100 text-slate-600 ring-slate-300"}>{active ? "Activo" : "Inactivo"}</Badge>;
}

export function JerseyNumber({ number }: { number: number | null }) {
  return <span className="inline-flex min-h-9 min-w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-1.5 text-xs font-bold text-[#102d50] tabular-nums"><span className="sr-only">{number === null ? "Sin número de camiseta" : "Camiseta "}</span>{number ?? "—"}</span>;
}
