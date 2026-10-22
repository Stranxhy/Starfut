"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/configuracion", label: "General" },
  { href: "/configuracion/horarios-canchas", label: "Horarios y canchas" },
  { href: "/configuracion/reglas", label: "Puntuación y desempates" },
  { href: "/configuracion/eliminatorias", label: "Eliminatorias y zonas" },
  { href: "/configuracion/temporadas", label: "Temporadas" },
  { href: "/configuracion/catalogos", label: "Catálogos de sanciones" },
];

export function ConfigTabs() {
  const path = usePathname();
  return (
    <nav className="scroll-thin mb-5 flex gap-1 overflow-x-auto border-b border-zinc-200" aria-label="Secciones de configuración">
      {TABS.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap ${active ? "border-brand-700 text-brand-800" : "border-transparent text-zinc-600 hover:text-zinc-900"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
