"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, ClipboardList, Download, Goal, ListOrdered } from "lucide-react";
import { Modal } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/core";
import { quickReportHref, type QuickReportDoc } from "@/domain/reports-view";
import { formatShort } from "@/lib/dates";

type League = { id: string; name: string };

/** Documentos de uso frecuente, con selección de liga y temporada explícita. */
export function WhatsAppPdfs({ seasonId, leagues, rolDate, resultsDate }: { seasonId: string; leagues: League[]; rolDate: string | null; resultsDate: string | null }) {
  const [pending, setPending] = useState<{ key: QuickReportDoc; download: boolean } | null>(null);
  const docs = [
    { key: "rol" as const, label: "Rol de juegos", date: rolDate, sub: rolDate ? formatShort(rolDate) : "Sin fecha de juego", description: "Horarios, canchas y rivales de la fecha elegida.", icon: CalendarDays, available: !!rolDate },
    { key: "resultados" as const, label: "Resultados", date: resultsDate, sub: resultsDate ? formatShort(resultsDate) : "Sin fecha de resultados", description: "Marcadores y estado de los partidos de la fecha elegida.", icon: ClipboardList, available: !!resultsDate },
    { key: "tabla-general" as const, label: "Tabla general", date: null, sub: "Clasificación actual", description: "Posiciones, puntos y estadísticas de la fase regular.", icon: ListOrdered, available: true },
    { key: "goleo" as const, label: "Goleadores", date: null, sub: "Fase regular", description: "Clasificación de goleo acumulada, sin amistosos ni eliminatorias.", icon: Goal, available: true },
  ];
  const single = leagues.length === 1 ? leagues[0] : null;
  const selected = docs.find((doc) => doc.key === pending?.key);

  return <>
    <div className="grid gap-4 sm:grid-cols-2">
      {docs.map((doc) => <article key={doc.key} className="flex min-w-0 flex-col rounded-xl border border-slate-300 bg-white">
        <div className="flex flex-1 items-start gap-3 px-5 py-4"><span className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-blue-800"><doc.icon className="h-5 w-5" aria-hidden /></span><div className="min-w-0"><h3 className="font-bold text-[#102d50]">{doc.label}</h3><p className="mt-1 text-xs font-semibold text-blue-800">{doc.sub}</p><p className="mt-2 text-xs leading-relaxed text-slate-600">{doc.description}</p></div></div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-3">
          {!leagues.length ? <Link href="/equipos" className="rounded text-xs font-semibold text-blue-800 underline focus-visible:outline-2 focus-visible:outline-blue-700">Registra equipos para generar el documento</Link>
          : !doc.available ? <Link href={doc.key === "rol" ? "/calendario" : "/resultados"} className="rounded text-xs font-semibold text-blue-800 underline focus-visible:outline-2 focus-visible:outline-blue-700">{doc.key === "rol" ? "Preparar calendario" : "Ir a resultados"}</Link>
          : single ? <>
            <a href={quickReportHref(doc.key, seasonId, single.id, doc.date)!} target="_blank" rel="noopener" className={buttonClass("primary", "sm")}>Abrir PDF<span className="sr-only"> de {doc.label}</span></a>
            <a href={quickReportHref(doc.key, seasonId, single.id, doc.date, true)!} className={buttonClass("secondary", "sm")}><Download className="h-4 w-4" aria-hidden />Descargar<span className="sr-only"> {doc.label}</span></a>
          </> : <>
            <button type="button" onClick={() => setPending({ key: doc.key, download: false })} className={buttonClass("primary", "sm")}>Abrir PDF<span className="sr-only"> de {doc.label}</span></button>
            <button type="button" onClick={() => setPending({ key: doc.key, download: true })} className={buttonClass("secondary", "sm")}><Download className="h-4 w-4" aria-hidden />Descargar<span className="sr-only"> {doc.label}</span></button>
          </>}
        </div>
      </article>)}
    </div>
    <Modal open={!!selected?.available && leagues.length > 0} onClose={() => setPending(null)} title={selected ? `${selected.label} · ${selected.sub}` : ""} description="Elige la liga del documento.">
      {selected?.available && pending && <div className="grid gap-2">{leagues.map((league) => <a key={league.id} href={quickReportHref(selected.key, seasonId, league.id, selected.date, pending.download)!} target={pending.download ? undefined : "_blank"} rel="noopener" onClick={() => setPending(null)} className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-[#102d50] hover:border-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"><span className="min-w-0 break-words">{league.name}</span><span className="shrink-0 text-xs text-blue-800">{pending.download ? "Descargar" : "Abrir PDF"}</span></a>)}</div>}
    </Modal>
  </>;
}
