"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";
import {
  CalendarDays, ChevronDown, FileText, Goal, History, Home, ListOrdered, Menu, Settings, Shield,
  ShieldAlert, Swords, Trophy, UserCog, Users, Network, X, type LucideIcon,
} from "lucide-react";

import { isNavigationActive, navigation, type NavigationItem } from "@/lib/navigation";

const icons: Record<string, LucideIcon> = {
  home: Home, calendar: CalendarDays, matches: Swords, table: ListOrdered, goal: Goal,
  bracket: Network, league: Trophy, team: Shield, players: Users, sanctions: ShieldAlert,
  reports: FileText, settings: Settings, history: History, users: UserCog,
};

export function Sidebar({ venue }: { venue: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const dialogId = useId();
  const settingsActive = navigation.some((g) => g.collapsible && g.items.some((i) => isNavigationActive(i, pathname)));
  const [showSettings, setShowSettings] = useState(settingsActive);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (settingsActive) setShowSettings(true);
  }, [settingsActive]);

  useEffect(() => {
    const node = dialog.current;
    if (open) node?.showModal();
    else node?.close();
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    closeOnDesktop();
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [open]);

  const link = (it: NavigationItem) => {
    const Icon = icons[it.icon];
    const active = isNavigationActive(it, pathname);
    return (
      <li key={it.href}>
        <Link
          href={it.href}
          onClick={() => setOpen(false)}
          aria-current={active ? "page" : undefined}
          className={clsx(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300",
            active ? "bg-white text-[#102d50] shadow ring-1 ring-[#ff981f]" : "text-white/85 hover:bg-white/10 hover:text-white",
          )}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          {it.label}
        </Link>
      </li>
    );
  };

  const nav = (
    <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
      {navigation.map((g, gi) =>
        g.collapsible ? (
          <div key={gi} className="border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              aria-expanded={showSettings}
              className="flex w-full items-center justify-between focus-visible:outline-2 focus-visible:outline-orange-300 rounded-lg px-3 py-1.5 text-[11px] font-bold tracking-[0.15em] text-white/70 uppercase hover:text-white/80"
            >
              {g.label}
              <ChevronDown className={clsx("h-4 w-4 transition", showSettings && "rotate-180")} aria-hidden />
            </button>
            {showSettings && <ul className="mt-1 space-y-0.5">{g.items.map(link)}</ul>}
          </div>
        ) : (
          <div key={gi}>
            {g.label && <p className="mb-1 px-3 text-[11px] font-bold tracking-[0.15em] text-white/70 uppercase">{g.label}</p>}
            <ul className="space-y-0.5">{g.items.map(link)}</ul>
          </div>
        ),
      )}
    </nav>
  );

  const brand = (
    <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-4">
      <Link href="/" onClick={() => setOpen(false)} className="block rounded focus-visible:outline-2 focus-visible:outline-orange-300">
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
        className="fixed top-3 left-3 z-40 rounded-lg bg-[#102d50] p-2 text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 lg:hidden"
        aria-label="Abrir menú"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
      >
        <Menu className="h-5 w-5" />
      </button>
      <aside className="bg-sport fixed inset-y-0 left-0 z-30 hidden w-64 flex-col text-white lg:flex">
        {brand}
        {nav}
      </aside>
      <dialog ref={dialog} id={dialogId} aria-label="Menú principal" onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setOpen(false);
        }}
        className="bg-sport fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[85vw] flex-col border-0 p-0 text-white shadow-2xl backdrop:bg-slate-950/60 open:flex">
        <button type="button" onClick={() => setOpen(false)} autoFocus
          className="absolute top-2 right-2 grid h-11 w-11 place-items-center rounded-lg text-white/90 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-orange-300" aria-label="Cerrar menú">
          <X className="h-5 w-5" aria-hidden />
        </button>
        {brand}
        {nav}
      </dialog>
    </>
  );
}
