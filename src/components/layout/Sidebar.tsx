"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  BarChart3, CalendarDays, ClipboardList, FileText, History, LayoutDashboard, ListOrdered, Menu, Settings,
  Goal, Shield, ShieldAlert, Swords, Trophy, Users, UserCog, Whistle, X,
} from "lucide-react";

const NAV = [
  { group: "General", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    group: "Competencia",
    items: [
      { href: "/ligas", label: "Ligas", icon: Trophy },
      { href: "/equipos", label: "Equipos", icon: Shield },
      { href: "/jugadores", label: "Jugadores", icon: Users },
      { href: "/arbitros", label: "Árbitros", icon: Whistle },
    ],
  },
  {
    group: "Programación",
    items: [
      { href: "/calendario", label: "Calendario y jornadas", icon: CalendarDays },
      { href: "/partidos", label: "Partidos", icon: Swords },
      { href: "/resultados", label: "Resultados", icon: ClipboardList },
    ],
  },
  {
    group: "Estadísticas",
    items: [
      { href: "/tabla", label: "Tabla general", icon: ListOrdered },
      { href: "/goleo", label: "Tabla de goleo", icon: Goal },
      { href: "/sanciones", label: "Sanciones", icon: ShieldAlert },
      { href: "/eliminatorias", label: "Eliminatorias", icon: BarChart3 },
    ],
  },
  { group: "Documentos", items: [{ href: "/reportes", label: "Reportes PDF", icon: FileText }] },
  {
    group: "Administración",
    items: [
      { href: "/configuracion", label: "Configuración del torneo", icon: Settings },
      { href: "/historial", label: "Historial de cambios", icon: History },
      { href: "/usuarios", label: "Usuarios y respaldos", icon: UserCog },
    ],
  },
];

export function Sidebar({ venue }: { venue: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="mb-1 px-3 text-[10px] font-bold tracking-[0.18em] text-white/40 uppercase">{g.group}</p>
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const Icon = it.icon;
              const active = isActive(it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                      active ? "bg-white text-brand-800 shadow" : "text-white/80 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-4">
      <Link href="/" className="block">
        <Image src="/brand/logo.png" alt="Starfutbol" width={160} height={70} className="h-auto w-36" priority />
        <span className="font-display mt-1 block text-[10px] tracking-[0.25em] text-white/70 uppercase">{venue}</span>
      </Link>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-3 left-3 z-40 rounded-lg bg-brand-800 p-2 text-white shadow-lg lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>
      <aside className="bg-sport fixed inset-y-0 left-0 z-30 hidden w-64 flex-col text-white lg:flex">
        {brand}
        {nav}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="bg-sport absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col text-white shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 rounded-md p-1 text-white/80 hover:bg-white/10"
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </button>
            {brand}
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
