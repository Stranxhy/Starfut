import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { getSeasonId } from "@/server/season";
import { createRefereeAction } from "@/server/actions/people";
import { RefereeCreateButton } from "@/components/forms/entity-forms";
import { Badge, buttonClass, Card, EmptyState, inputClass, LinkButton, PageHeader, Table, TD, TH } from "@/components/ui/core";
import { str, type SP } from "@/lib/params";
import { fromISODate, todayISO } from "@/lib/dates";
import { normalizeName } from "@/domain/text";

export const metadata = { title: "Árbitros" };

export default async function ArbitrosPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const seasonId = await getSeasonId();
  const sp = await searchParams;
  const q = str(sp.q);
  const estado = str(sp.estado) ?? "activos";
  const where: Prisma.RefereeWhereInput = {
    ...(estado === "activos" ? { active: true } : estado === "inactivos" ? { active: false } : {}),
    ...(q ? { nameKey: { contains: normalizeName(q) } } : {}),
  };
  const today = fromISODate(todayISO());
  const [referees, past, future] = await Promise.all([
    prisma.referee.findMany({ where, orderBy: { name: "asc" } }),
    prisma.match.groupBy({ by: ["refereeId"], where: { seasonId: seasonId ?? undefined, status: "JUGADO", refereeId: { not: null } }, _count: true }),
    prisma.match.groupBy({
      by: ["refereeId"],
      where: { seasonId: seasonId ?? undefined, status: { in: ["PROGRAMADO", "REPROGRAMADO"] }, date: { gte: today }, refereeId: { not: null } },
      _count: true,
    }),
  ]);
  return (
    <>
      <PageHeader
        title="Árbitros"
        description="Registra en cada árbitro las fechas en que no puede asistir."
        actions={
          <>
            <LinkButton href="/api/pdf/arbitros" target="_blank" variant="secondary">PDF</LinkButton>
            <RefereeCreateButton action={createRefereeAction} />
          </>
        }
      />
      <Card>
        <form className="flex flex-wrap items-end gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5" role="search">
          <div className="min-w-48 flex-1">
            <label htmlFor="q" className="mb-1 block text-xs font-semibold text-zinc-700">Buscar</label>
            <input id="q" name="q" defaultValue={q} className={inputClass} placeholder="Nombre" />
          </div>
          <div>
            <label htmlFor="estado" className="mb-1 block text-xs font-semibold text-zinc-700">Estado</label>
            <select id="estado" name="estado" defaultValue={estado} className={inputClass}>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
              <option value="todos">Todos</option>
            </select>
          </div>
          <button className={buttonClass("dark")}>Filtrar</button>
        </form>
        {referees.length === 0 ? (
          <EmptyState title="Sin árbitros" description="Registra a los árbitros para asignarlos a los partidos." />
        ) : (
          <Table>
            <thead>
              <tr>
                <TH>Árbitro</TH>
                <TH>Teléfono</TH>
                <TH className="text-center">Partidos arbitrados (temporada)</TH>
                <TH className="text-center">Asignaciones futuras</TH>
                <TH>Estado</TH>
              </tr>
            </thead>
            <tbody>
              {referees.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50">
                  <TD className="font-semibold">
                    <Link href={`/arbitros/${r.id}`} className="hover:text-brand-700 hover:underline">{r.name}</Link>
                    {r.isDemo && <Badge className="ml-2 bg-amber-100 text-amber-900 ring-amber-300">Demo</Badge>}
                  </TD>
                  <TD className="text-zinc-600">{r.phone ?? "—"}</TD>
                  <TD className="text-center tabular-nums">{past.find((p) => p.refereeId === r.id)?._count ?? 0}</TD>
                  <TD className="text-center tabular-nums">{future.find((p) => p.refereeId === r.id)?._count ?? 0}</TD>
                  <TD>{r.active ? <Badge className="bg-emerald-100 text-emerald-900 ring-emerald-300">Activo</Badge> : <Badge>Inactivo</Badge>}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
