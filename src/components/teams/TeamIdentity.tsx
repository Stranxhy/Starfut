import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/core";

export function TeamCrest({ id, hasLogo, large = false }: { id: string; hasLogo: boolean; large?: boolean }) {
  return <span className={`grid shrink-0 place-items-center rounded-xl border border-slate-200 bg-white ${large ? "h-16 w-16 p-2" : "h-10 w-10 p-1.5"}`} aria-hidden>
    {hasLogo ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/api/escudo/${id}`} alt="" loading="lazy" className="h-full w-full object-contain" />
    ) : <Shield className={`${large ? "h-8 w-8" : "h-5 w-5"} text-blue-800`} />}
  </span>;
}

export function TeamStatus({ active }: { active: boolean }) {
  return <Badge className={active ? "bg-emerald-50 text-emerald-900 ring-emerald-300" : "bg-slate-100 text-slate-600 ring-slate-300"}>{active ? "Activo" : "Baja"}</Badge>;
}
