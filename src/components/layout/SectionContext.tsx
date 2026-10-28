"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ClipboardList, Swords } from "lucide-react";
import { matchViewHref, navigationContext } from "@/lib/navigation";

export function SectionContext() {
  const pathname = usePathname();
  const params = useSearchParams();
  const context = navigationContext(pathname);
  if (!context || pathname === "/") return null;
  const matches = context.item.href === "/partidos";
  const results = pathname === "/resultados" || pathname.startsWith("/resultados/");
  const date = params.get(results ? "date" : "fecha");
  return (
    <div className="mb-5">
      <p className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <Link href="/" className="rounded hover:text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-blue-700">Inicio</Link>
        <span aria-hidden>/</span>
        {context.group && <><span>{context.group}</span><span aria-hidden>/</span></>}
        <span className="font-semibold text-slate-800">{context.item.label}</span>
      </p>
      {matches && (
        <nav aria-label="Vistas de partidos" className="flex flex-wrap gap-2 border-b border-slate-300 pb-3">
          {([
            { href: "/partidos", label: "Ver partidos", icon: Swords, active: !results },
            { href: "/resultados", label: "Capturar resultados", icon: ClipboardList, active: results },
          ] as const).map(({ href, label, icon: Icon, active }) => (
            <Link key={href} href={matchViewHref(href, date, params.get("liga"))} aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${active ? "border-[#102d50] bg-[#102d50] text-white" : "border-slate-300 bg-white text-slate-700 hover:border-blue-700 hover:bg-blue-50"}`}>
              <Icon className="h-4 w-4" aria-hidden />{label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
