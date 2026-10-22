import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { buttonClass, Card, EmptyState, inputClass, PageHeader, Pagination, withParams } from "@/components/ui/core";
import { AuditDiff } from "@/components/AuditList";
import { formatDateTime, fromISODate } from "@/lib/dates";
import { AUDIT_ACTION } from "@/lib/labels";
import { int, str, type SP } from "@/lib/params";

export const metadata = { title: "Historial de cambios" };
const SIZE = 40;

const ENTITY_LINK: Record<string, string> = {
  Partido: "/partidos/",
  Equipo: "/equipos/",
  Jugador: "/jugadores/",
  "Árbitro": "/arbitros/",
  "Sanción": "/sanciones/",
  Liga: "/ligas/",
};

export default async function HistorialPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const sp = await searchParams;
  const entity = str(sp.entidad);
  const action = str(sp.accion);
  const userId = str(sp.usuario);
  const q = str(sp.q);
  const desde = str(sp.desde);
  const hasta = str(sp.hasta);
  const page = int(sp.page, 1);
  const valid = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);
  const where: Prisma.AuditLogWhereInput = {
    ...(entity ? { entity } : {}),
    ...(action ? { action } : {}),
    ...(userId ? { userId } : {}),
    ...(q ? { OR: [{ summary: { contains: q, mode: "insensitive" } }, { reason: { contains: q, mode: "insensitive" } }] } : {}),
    ...(valid(desde) || valid(hasta)
      ? {
          createdAt: {
            ...(valid(desde) ? { gte: fromISODate(desde!) } : {}),
            ...(valid(hasta) ? { lt: new Date(fromISODate(hasta!).getTime() + 86_400_000) } : {}),
          },
        }
      : {}),
  };
  const [total, logs, entities, users] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * SIZE, take: SIZE, include: { user: { select: { name: true } } } }),
    prisma.auditLog.groupBy({ by: ["entity"], orderBy: { entity: "asc" } }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const base = { entidad: entity, accion: action, usuario: userId, q, desde, hasta };

  return (
    <>
      <PageHeader
        title="Historial de cambios"
      />
      <Card>
        <form className="grid grid-cols-2 items-end gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5 md:grid-cols-4 xl:grid-cols-7" role="search">
          <label className="col-span-2 text-xs font-semibold text-zinc-700">Buscar<input name="q" defaultValue={q} className={`${inputClass} mt-1`} placeholder="Resumen o motivo" /></label>
          <label className="text-xs font-semibold text-zinc-700">Registro
            <select name="entidad" defaultValue={entity ?? ""} className={`${inputClass} mt-1`}>
              <option value="">Todos</option>
              {entities.map((e) => <option key={e.entity} value={e.entity}>{e.entity}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-zinc-700">Acción
            <select name="accion" defaultValue={action ?? ""} className={`${inputClass} mt-1`}>
              <option value="">Todas</option>
              {Object.entries(AUDIT_ACTION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-zinc-700">Usuario
            <select name="usuario" defaultValue={userId ?? ""} className={`${inputClass} mt-1`}>
              <option value="">Todos</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-zinc-700">Desde<input type="date" name="desde" defaultValue={desde} className={`${inputClass} mt-1`} /></label>
          <label className="text-xs font-semibold text-zinc-700">Hasta<input type="date" name="hasta" defaultValue={hasta} className={`${inputClass} mt-1`} /></label>
          <div className="col-span-2 flex gap-2 md:col-span-4 xl:col-span-7">
            <button className={buttonClass("dark")}>Filtrar</button>
            <Link href="/historial" className={buttonClass("ghost")}>Limpiar</Link>
          </div>
        </form>
        {logs.length === 0 ? (
          <EmptyState title="Sin registros" />
        ) : (
          <ol className="divide-y divide-zinc-100">
            {logs.map((l) => (
              <li key={l.id} className="px-4 py-3 text-sm sm:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p>
                    <span className="mr-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-bold text-zinc-600">{l.entity}</span>
                    <span className="font-semibold text-zinc-900">{AUDIT_ACTION[l.action] ?? l.action}</span>
                    {l.summary && (
                      <span className="text-zinc-700">
                        {" · "}
                        {l.entityId && ENTITY_LINK[l.entity] ? <Link href={`${ENTITY_LINK[l.entity]}${l.entityId}`} className="hover:text-brand-700 hover:underline">{l.summary}</Link> : l.summary}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">{formatDateTime(l.createdAt)} · {l.user?.name ?? "Sistema"}</p>
                </div>
                {l.reason && <p className="mt-0.5 text-xs text-zinc-700"><span className="font-semibold">Motivo:</span> {l.reason}</p>}
                {(l.before || l.after) && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-zinc-500">Ver valores</summary>
                    <AuditDiff before={l.before} after={l.after} />
                  </details>
                )}
              </li>
            ))}
          </ol>
        )}
        <Pagination page={page} pageCount={Math.ceil(total / SIZE)} total={total} hrefFor={(p) => withParams("/historial", { ...base, page: p })} />
      </Card>
    </>
  );
}
