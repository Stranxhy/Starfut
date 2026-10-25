"use client";

import { useState } from "react";
import { CalendarDays, ClipboardList, Download, Goal, ListOrdered, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/ui/form";
import { formatShort } from "@/lib/dates";

type League = { id: string; name: string };
type Doc = { key: string; label: string; sub: string; icon: LucideIcon; url: (leagueId: string) => string };

/**
 * Los 4 PDF que se envían por WhatsApp. Al tocar uno se pregunta la liga
 * (si solo hay una liga con equipos, se abre directamente).
 */
export function WhatsAppPdfs({ leagues, rolDate, resultsDate }: { leagues: League[]; rolDate: string | null; resultsDate: string | null }) {
  const [pending, setPending] = useState<{ doc: Doc; download: boolean } | null>(null);

  const docs: Doc[] = [
    ...(rolDate
      ? [{ key: "rol", label: "Rol de juegos", sub: formatShort(rolDate), icon: CalendarDays, url: (l: string) => `/api/pdf/rol?date=${rolDate}&league=${l}` }]
      : []),
    ...(resultsDate
      ? [{ key: "res", label: "Resultados", sub: formatShort(resultsDate), icon: ClipboardList, url: (l: string) => `/api/pdf/resultados?date=${resultsDate}&league=${l}` }]
      : []),
    { key: "tabla", label: "Tabla general", sub: "Actual", icon: ListOrdered, url: (l: string) => `/api/pdf/tabla-general?league=${l}` },
    { key: "goleo", label: "Goleo", sub: "Actual", icon: Goal, url: (l: string) => `/api/pdf/goleo?league=${l}` },
  ];

  const href = (doc: Doc, leagueId: string, download: boolean) => `${doc.url(leagueId)}${download ? "&download=1" : ""}`;
  const single = leagues.length === 1 ? leagues[0] : null;

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <div className="grid gap-2 sm:grid-cols-2">
        {docs.map((d) => {
          const Icon = d.icon;
          const tile = (
            <>
              <Icon className="h-5 w-5 shrink-0 text-brand-700" aria-hidden />
              <span className="min-w-0 text-left">
                <span className="block text-sm font-semibold text-zinc-900">{d.label}</span>
                <span className="block text-xs text-zinc-500">{d.sub}</span>
              </span>
            </>
          );
          const main = "flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 hover:bg-brand-50";
          const side =
            "grid w-11 shrink-0 place-items-center border-l border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-brand-700";
          return (
            <div key={d.key} className="flex overflow-hidden rounded-lg ring-1 ring-zinc-200 transition hover:ring-brand-400">
              {single ? (
                <>
                  <a href={href(d, single.id, false)} target="_blank" className={main}>{tile}</a>
                  <a href={href(d, single.id, true)} title="Descargar PDF" aria-label={`Descargar ${d.label}`} className={side}>
                    <Download className="h-4 w-4" />
                  </a>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setPending({ doc: d, download: false })} className={main} disabled={!leagues.length}>
                    {tile}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPending({ doc: d, download: true })}
                    title="Descargar PDF"
                    aria-label={`Descargar ${d.label}`}
                    className={side}
                    disabled={!leagues.length}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending ? `${pending.doc.label}${pending.doc.sub !== "Actual" ? ` · ${pending.doc.sub}` : ""}` : ""}
        description={pending?.download ? "¿De qué liga quieres descargar el documento?" : "¿De qué liga quieres el documento?"}
      >
        {pending && (
          <div className="grid gap-2">
            {leagues.map((l) => (
              <a
                key={l.id}
                href={href(pending.doc, l.id, pending.download)}
                target={pending.download ? undefined : "_blank"}
                onClick={() => setPending(null)}
                className="flex items-center justify-between rounded-lg px-4 py-3 text-base font-semibold text-zinc-900 ring-1 ring-zinc-200 transition hover:bg-brand-50 hover:ring-brand-400"
              >
                {l.name}
                {pending.download ? <Download className="h-4 w-4 text-zinc-400" /> : <span className="text-sm text-brand-700">Abrir</span>}
              </a>
            ))}
          </div>
        )}
      </Modal>
    </section>
  );
}
