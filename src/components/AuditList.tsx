import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/dates";
import { AUDIT_ACTION } from "@/lib/labels";
import { EmptyState } from "@/components/ui/core";

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Cambios de valores en formato legible (antes → después). */
export function AuditDiff({ before, after }: { before: unknown; after: unknown }) {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  if (!keys.length) return null;
  return (
    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      {keys.map((k) => {
        const bv = renderValue(b[k]);
        const av = renderValue(a[k]);
        const changed = before !== undefined && before !== null && bv !== av;
        return (
          <div key={k} className="contents">
            <dt className="font-semibold text-zinc-500">{k}</dt>
            <dd className="break-words text-zinc-800">
              {before !== undefined && before !== null && after !== undefined && after !== null ? (
                changed ? (
                  <>
                    <span className="text-red-700 line-through">{bv}</span> → <span className="text-emerald-700">{av}</span>
                  </>
                ) : (
                  <span className="text-zinc-500">{av}</span>
                )
              ) : (
                <span>{after !== undefined && after !== null ? av : bv}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export async function AuditList({ entity, entityId, limit = 30 }: { entity: string | string[]; entityId: string; limit?: number }) {
  const logs = await prisma.auditLog.findMany({
    where: { entity: { in: Array.isArray(entity) ? entity : [entity] }, entityId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true } } },
  });
  if (!logs.length) return <EmptyState title="Sin cambios registrados" />;
  return (
    <ol className="divide-y divide-zinc-100">
      {logs.map((l) => (
        <li key={l.id} className="px-4 py-3 text-sm sm:px-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p>
              <span className="font-semibold text-zinc-900">{AUDIT_ACTION[l.action] ?? l.action}</span>
              {l.summary && <span className="text-zinc-600"> · {l.summary}</span>}
            </p>
            <p className="text-xs text-zinc-500">
              {formatDateTime(l.createdAt)} · {l.user?.name ?? "Sistema"}
            </p>
          </div>
          {l.reason && <p className="mt-0.5 text-xs text-zinc-700">Motivo: {l.reason}</p>}
          <AuditDiff before={l.before} after={l.after} />
        </li>
      ))}
    </ol>
  );
}
