import Link from "next/link";
import type { Prisma, SanctionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { createSanctionAction } from "@/server/actions/sanctions";
import { SanctionCreateButton } from "@/components/forms/SanctionForm";
import { Badge, buttonClass, Card, EmptyState, inputClass, LinkButton, PageHeader, Pagination, Table, TD, TH, withParams } from "@/components/ui/core";
import { formatShort, fromISODate } from "@/lib/dates";
import { SANCTION_STATUS } from "@/lib/labels";
import { PAGE_SIZE, int, str, type SP } from "@/lib/params";
import { normalizeName } from "@/domain/text";
import { loadSanctionFormData } from "./data";

export const metadata = { title: "Sanciones" };

export default async function SancionesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Sin temporada" />;
  const sp = await searchParams;
  const q = str(sp.q);
  const equipo = str(sp.equipo);
  const liga = str(sp.liga);
  const tipo = str(sp.tipo);
  const estado = str(sp.estado);
  const desde = str(sp.desde);
  const hasta = str(sp.hasta);
  const page = int(sp.page, 1);
  const valid = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);

  const where: Prisma.SanctionWhereInput = {
    seasonId: ctx.id,
    ...(equipo ? { teamId: equipo } : {}),
    ...(liga ? { team: { leagueId: liga } } : {}),
    ...(tipo ? { typeId: tipo } : {}),
    ...(estado && estado in SANCTION_STATUS ? { status: estado as SanctionStatus } : {}),
    ...(q ? { player: { nameKey: { contains: normalizeName(q) } } } : {}),
    ...(valid(desde) || valid(hasta)
      ? { date: { ...(valid(desde) ? { gte: fromISODate(desde!) } : {}), ...(valid(hasta) ? { lte: fromISODate(hasta!) } : {}) } }
      : {}),
  };
  const [total, sanctions, formData] = await Promise.all([
    prisma.sanction.count({ where }),
    prisma.sanction.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        player: { select: { id: true, fullName: true } },
        team: { select: { id: true, name: true } },
        type: true,
        unit: true,
        _count: { select: { servings: true } },
      },
    }),
    loadSanctionFormData(ctx.id),
  ]);
  const base = { q, equipo, liga, tipo, estado, desde, hasta };
  const pdfHref = withParams("/api/pdf/sanciones", { league: liga, team: equipo, status: estado, type: tipo, from: valid(desde), to: valid(hasta) });

  return (
    <>
      <PageHeader
        title="Sanciones"
        actions={
          <>
            <LinkButton href={pdfHref} target="_blank" variant="secondary">PDF {Object.values(base).some(Boolean) ? "filtrado" : "completo"}</LinkButton>
            <SanctionCreateButton action={createSanctionAction} data={formData} />
          </>
        }
      />
      <Card>
        <form className="grid grid-cols-2 items-end gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5 md:grid-cols-4 xl:grid-cols-8" role="search">
          <div className="col-span-2">
            <label htmlFor="q" className="mb-1 block text-xs font-semibold text-zinc-700">Jugador</label>
            <input id="q" name="q" defaultValue={q} className={inputClass} placeholder="Nombre" />
          </div>
          <div>
            <label htmlFor="liga" className="mb-1 block text-xs font-semibold text-zinc-700">Liga</label>
            <select id="liga" name="liga" defaultValue={liga ?? ""} className={inputClass}>
              <option value="">Todas</option>
              {ctx.leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="equipo" className="mb-1 block text-xs font-semibold text-zinc-700">Equipo</label>
            <select id="equipo" name="equipo" defaultValue={equipo ?? ""} className={inputClass}>
              <option value="">Todos</option>
              {formData.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="tipo" className="mb-1 block text-xs font-semibold text-zinc-700">Tipo</label>
            <select id="tipo" name="tipo" defaultValue={tipo ?? ""} className={inputClass}>
              <option value="">Todos</option>
              {formData.types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="estado" className="mb-1 block text-xs font-semibold text-zinc-700">Estado</label>
            <select id="estado" name="estado" defaultValue={estado ?? ""} className={inputClass}>
              <option value="">Todos</option>
              {Object.entries(SANCTION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="desde" className="mb-1 block text-xs font-semibold text-zinc-700">Desde</label>
            <input id="desde" type="date" name="desde" defaultValue={desde} className={inputClass} />
          </div>
          <div>
            <label htmlFor="hasta" className="mb-1 block text-xs font-semibold text-zinc-700">Hasta</label>
            <input id="hasta" type="date" name="hasta" defaultValue={hasta} className={inputClass} />
          </div>
          <div className="col-span-2 flex gap-2 md:col-span-4 xl:col-span-8">
            <button className={buttonClass("dark")}>Filtrar</button>
            <Link href="/sanciones" className={buttonClass("ghost")}>Limpiar</Link>
          </div>
        </form>
        {sanctions.length === 0 ? (
          <EmptyState title="Sin sanciones que coincidan" />
        ) : (
          <Table>
            <thead>
              <tr><TH>Fecha</TH><TH>Jugador</TH><TH>Equipo</TH><TH>Tipo</TH><TH>Motivo</TH><TH>Duración</TH><TH>Cumplimiento</TH><TH>Estado</TH></tr>
            </thead>
            <tbody>
              {sanctions.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50">
                  <TD><Link href={`/sanciones/${s.id}`} className="font-semibold hover:text-brand-700 hover:underline">{formatShort(s.date)}</Link></TD>
                  <TD className="font-semibold"><Link href={`/jugadores/${s.player.id}`} className="hover:underline">{s.player.fullName}</Link></TD>
                  <TD>{s.team.name}</TD>
                  <TD>{s.type.name}</TD>
                  <TD className="max-w-xs truncate text-zinc-600" title={s.reason}>{s.reason}</TD>
                  <TD className="whitespace-nowrap">{s.duration} {s.unit.name.toLowerCase()}</TD>
                  <TD className="tabular-nums">{s.unit.kind === "PARTIDOS" ? `${s._count.servings} / ${s.duration} partidos` : s._count.servings ? `${s._count.servings} registro(s)` : "—"}</TD>
                  <TD><Badge className={SANCTION_STATUS[s.status].className}>{SANCTION_STATUS[s.status].label}</Badge></TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} total={total} hrefFor={(p) => withParams("/sanciones", { ...base, page: p })} />
      </Card>
    </>
  );
}
