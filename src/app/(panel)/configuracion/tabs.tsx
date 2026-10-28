"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Clock, ListChecks, Settings2, ShieldAlert, Trophy } from "lucide-react";

const TABS = [
  { href: "/configuracion", label: "General", icon: Settings2 },
  { href: "/configuracion/horarios-canchas", label: "Horarios y canchas", icon: Clock },
  { href: "/configuracion/reglas", label: "Puntuación y desempates", icon: ListChecks },
  { href: "/configuracion/eliminatorias", label: "Eliminatorias y zonas", icon: Trophy },
  { href: "/configuracion/temporadas", label: "Temporadas", icon: CalendarDays },
  { href: "/configuracion/catalogos", label: "Catálogos de sanciones", icon: ShieldAlert },
];

export function ConfigTabs() {
  const path = usePathname();
  return <nav className="mb-6 grid grid-cols-2 gap-2 xl:grid-cols-3" aria-label="Secciones de configuración">
    {TABS.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={path === href ? "page" : undefined} className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-3 text-xs font-semibold sm:px-4 sm:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${path === href ? "border-orange-400 bg-[#102d50] text-white" : "border-slate-300 bg-white text-slate-700 hover:border-blue-700 hover:bg-blue-50"}`}><Icon className="h-4 w-4 shrink-0" aria-hidden /><span className="break-words">{label}</span></Link>)}
  </nav>;
}
