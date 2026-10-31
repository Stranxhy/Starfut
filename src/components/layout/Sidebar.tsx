"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  CalendarDays, ChevronDown, ClipboardList, FileText, Goal, History, Home, ListOrdered, Menu, Settings, Shield,
  ShieldAlert, Swords, Trophy, UserCog, Users, Network, X, type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon };
type Group = { group?: string; items: Item[]; collapsible?: boolean };

// Menú organizado por tareas: lo que se usa cada domingo primero; los ajustes, plegados.
const NAV: Group[] = [
  { items: [{ href: "/", label: "Inicio", icon: Home }] },
  {
    group: "Domingo",
    items: [
      { href: "/resultados", label: "Resultados", icon: ClipboardList },
      { href: "/partidos", label: "Partidos", icon: Swords },
      { href: "/calendario", label: "Calendario", icon: CalendarDays },
    ],
  },
  {
    group: "Clasificación",
    items: [
      { href: "/tabla", label: "Tabla general", icon: ListOrdered },
      { href: "/goleo", label: "Goleo", icon: Goal },
      { href: "/eliminatorias", label: "Eliminatorias", icon: Network },
    ],
  },
  {
    group: "Registro",
    items: [
      { href: "/equipos", label: "Equipos", icon: Shield },
      { href: "/jugadores", label: "Jugadores", icon: Users },
      { href: "/sanciones", label: "Sanciones", icon: ShieldAlert },
    ],
  },
  { items: [{ href: "/reportes", label: "PDF para WhatsApp", icon: FileText }] },
  {
    group: "Ajustes",
    collapsible: true,
    items: [
      { href: "/ligas", label: "Ligas", icon: Trophy },
      { href: "/configuracion", label: "Configuración", icon: Settings },
      { href: "/historial", label: "Historial de cambios", icon: History },
      { href: "/usuarios", label: "Usuarios y respaldos", icon: UserCog },
    ],
  },
];

export function Sidebar({ venue }: { venue: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const settingsActive = NAV.find((g) => g.collapsible)!.items.some((i) => isActive(i.href));
  const [showSettings, setShowSettings] = useState(settingsActive);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (settingsActive) setShowSettings(true);
  }, [settingsActive]);

  const link = (it: Item) => {
    const Icon = it.icon;
    const active = isActive(it.href);
    return (
      <li key={it.href}>
        <Link
          href={it.href}
          aria-current={active ? "page" : undefined}
          className={clsx(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
            active
              ? "bg-brand-50 text-brand-700 shadow-[inset_3px_0_0_var(--color-accent-500)]"
              : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900",
          )}
        >
          <Icon className={clsx("h-4 w-4 shrink-0", active ? "text-brand-600" : "text-zinc-400")} aria-hidden />
          {it.label}
        </Link>
      </li>
    );
  };

  const nav = (
    <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
      {NAV.map((g, gi) =>
        g.collapsible ? (
          <div key={gi} className="border-t border-zinc-200 pt-3">
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              aria-expanded={showSettings}
              className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-bold tracking-[0.15em] text-zinc-400 uppercase hover:text-zinc-700"
            >
              {g.group}
              <ChevronDown className={clsx("h-4 w-4 transition", showSettings && "rotate-180")} aria-hidden />
            </button>
            {showSettings && <ul className="mt-1 space-y-0.5">{g.items.map(link)}</ul>}
          </div>
        ) : (
          <div key={gi}>
            {g.group && <p className="mb-1 px-3 text-[11px] font-bold tracking-[0.15em] text-zinc-400 uppercase">{g.group}</p>}
            <ul className="space-y-0.5">{g.items.map(link)}</ul>
          </div>
        ),
      )}
    </nav>
  );

  const brand = (
    <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-5 py-4">
      <Link href="/" className="block">
        <Image src="/brand/logo.png" alt="Starfutbol" width={160} height={70} className="h-auto w-36" priority />
        <span className="font-display mt-1 block text-[10px] tracking-[0.25em] text-accent-700 uppercase">{venue}</span>
      </Link>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-3 left-3 z-40 rounded-lg bg-white p-2 text-brand-700 shadow-md ring-1 ring-zinc-200 lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-zinc-200 bg-white lg:flex">
        <div className="brand-stripe h-1 shrink-0" />
        {brand}
        {nav}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-zinc-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl">
            <div className="brand-stripe h-1 shrink-0" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 rounded-md p-1 text-zinc-500 hover:bg-zinc-100"
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
