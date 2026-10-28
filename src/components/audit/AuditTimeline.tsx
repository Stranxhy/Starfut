import Link from "next/link";
import type { AuditLog } from "@prisma/client";
import { ArrowUpRight, Clock3, History, UserRound } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { auditActionLabel, auditChanges, auditEntityLabel, auditRecordHref, auditValue, AUDIT_USER_FALLBACK } from "@/domain/audit-view";

type Change = ReturnType<typeof auditChanges>[number];
type Entry = AuditLog & { user: { name: string } | null };

function ChangeRows({ changes }: { changes: Change[] }) {
  return <dl className="divide-y divide-slate-200">
    {changes.map((change) => <div key={change.key} className="grid min-w-0 gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
      <dt className="min-w-0 break-words text-xs font-semibold text-[#102d50]">{change.label}</dt>
      <dd className="grid min-w-0 gap-3 sm:grid-cols-2">
        {(["before", "after"] as const).map((side) => <div key={side} className={`min-w-0 rounded-lg border p-3 ${change.changed && side === "after" ? "border-blue-200 bg-blue-50/70" : "border-slate-200 bg-white"}`}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{side === "before" ? "Antes" : "Después"}</p>
          <pre tabIndex={0} aria-label={`${change.label}: ${side === "before" ? "antes" : "después"}`} className={`max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${typeof change[side] === "object" && change[side] !== null ? "font-mono" : "font-sans"}`}>{auditValue(change[side])}</pre>
        </div>)}
      </dd>
    </div>)}
  </dl>;
}

/** Conserva valores nulos y campos sin cambios; las estructuras anidadas mantienen su contenido. */
export function AuditDiff({ before, after }: { before: unknown; after: unknown }) {
  const changes = auditChanges(before, after);
  const changed = changes.filter((change) => change.changed);
  const unchanged = changes.filter((change) => !change.changed);
  if (!changes.length) return null;
  const hasBefore = before !== null && before !== undefined;
  const hasAfter = after !== null && after !== undefined;
  return <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
    {hasBefore !== hasAfter && <p className="border-b border-slate-200 px-4 py-3 text-xs leading-relaxed text-slate-600">Este registro conserva solo los valores {hasBefore ? "anteriores" : "posteriores"} a la acción.</p>}
    <ChangeRows changes={changed} />
    {unchanged.length > 0 && <details className={changed.length ? "border-t border-slate-200" : undefined}>
      <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-700">{unchanged.length} {unchanged.length === 1 ? "campo sin cambios" : "campos sin cambios"}</summary>
      <ChangeRows changes={unchanged} />
    </details>}
  </div>;
}

function actionTone(action: string) {
  if (["CREAR", "ACTIVAR", "RESULTADO", "CALENDARIO_CONFIRMADO"].includes(action)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["DESACTIVAR", "CANCELAR", "REVERTIR_RESULTADO"].includes(action)) return "border-amber-200 bg-amber-50 text-amber-900";
  if (action === "ELIMINAR") return "border-red-200 bg-red-50 text-red-800";
  return "border-blue-200 bg-blue-50 text-blue-900";
}

export function AuditTimeline({ logs, linkRecords = false }: { logs: Entry[]; linkRecords?: boolean }) {
  return <ol aria-label="Actividad registrada, de más reciente a más antigua" className="divide-y divide-slate-200">
    {logs.map((log) => {
      const href = linkRecords ? auditRecordHref(log.entity, log.entityId, log.action) : null;
      const changes = auditChanges(log.before, log.after);
      const changedCount = changes.filter((change) => change.changed).length;
      const comparison = log.before !== null && log.after !== null;
      return <li key={log.id} className="px-4 py-5 sm:px-5">
        <article className="flex min-w-0 gap-3 sm:gap-4">
          <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-[#102d50] sm:flex"><History className="h-5 w-5" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
              <div className="min-w-0 flex-1 basis-64">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`max-w-full break-words rounded-md border px-2 py-1 font-semibold ${actionTone(log.action)}`}>{auditActionLabel(log.action)}</span>
                  <span className="font-medium text-slate-600">{auditEntityLabel(log.entity)}</span>
                </div>
                <h3 className="break-words text-sm font-bold leading-relaxed text-[#102d50]">{log.summary || `${auditActionLabel(log.action)} de ${auditEntityLabel(log.entity)}`}</h3>
              </div>
              <div className="min-w-0 max-w-full space-y-1.5 text-xs text-slate-600">
                <p className="flex items-start gap-2"><Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden /><time dateTime={log.createdAt.toISOString()} className="tabular-nums">{formatDateTime(log.createdAt)}</time></p>
                <p className="flex items-start gap-2"><UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="break-words"><span className="sr-only">Usuario: </span>{log.user?.name ?? AUDIT_USER_FALLBACK}</span></p>
              </div>
            </div>
            {log.reason && <p className="mt-3 whitespace-pre-wrap break-words rounded-r-lg border-l-2 border-orange-300 bg-orange-50/70 px-3 py-2 text-xs leading-relaxed text-slate-700"><span className="font-semibold">Motivo: </span>{log.reason}</p>}
            {changes.length > 0 && <details className="mt-3">
              <summary className="w-fit cursor-pointer rounded py-1 text-xs font-semibold text-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                {comparison ? `Ver detalle · ${changedCount} ${changedCount === 1 ? "campo con cambios" : "campos con cambios"}` : "Ver valores registrados"}
              </summary>
              <AuditDiff before={log.before} after={log.after} />
            </details>}
            {href && <Link href={href} className="mt-3 inline-flex min-h-8 items-center gap-1 rounded text-xs font-semibold text-blue-900 underline underline-offset-4 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">Abrir registro actual<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></Link>}
          </div>
        </article>
      </li>;
    })}
  </ol>;
}
