import Link from "next/link";
import type { Prisma, SanctionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { createSanctionAction } from "@/server/actions/sanctions";
import { SanctionCreateButton } from "@/components/forms/SanctionForm";
import { Badge, Card, EmptyState, inputClass, LinkButton, PageHeader, Pagination, Table, TD, TH, withParams } from "@/components/ui/core";
import { formatShort, fromISODate } from "@/lib/dates";
import { SANCTION_STATUS } from "@/lib/labels";
import { PAGE_SIZE, int, str, type SP } from "@/lib/params";
import { normalizeName } from "@/domain/text";
import { loadSanctionFormData } from "./data";

import { FilterField, FilterPanel, FilterSelect } from "@/components/ui/filters";
import { SearchableFilter } from "@/components/ui/SearchableFilter";

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

  const seasonTotal = total || await prisma.sanction.count({ where: { seasonId: ctx.id } });

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
        <FilterPanel key={JSON.stringify(base)} path="/sanciones" params={base} total={total} chips={[
          { name: "q", label: "Jugador", value: q },
          { name: "liga", label: "Liga", value: liga ? ctx.leagues.find((l) => l.id === liga)?.name ?? "Selección no disponible" : undefined },
          { name: "equipo", label: "Equipo", value: equipo ? formData.teams.find((t) => t.id === equipo)?.name ?? "Selección no disponible" : undefined },
          { name: "estado", label: "Estado", value: estado && estado in SANCTION_STATUS ? SANCTION_STATUS[estado as SanctionStatus].label : undefined },
          { name: "tipo", label: "Tipo", value: tipo ? formData.types.find((t) => t.value === tipo)?.label ?? "Selección no disponible" : undefined },
          { name: "desde", label: "Desde", value: desde ? formatShort(desde) : undefined },
          { name: "hasta", label: "Hasta", value: hasta ? formatShort(hasta) : undefined },
        ]} advancedOpen={!!(tipo || desde || hasta)} advanced={<>
          <FilterSelect name="tipo" label="Tipo de sanción" value={tipo} options={formData.types} />
          <FilterField name="desde" label="Desde"><input id="desde" type="date" name="desde" defaultValue={desde} className={inputClass} /></FilterField>
          <FilterField name="hasta" label="Hasta"><input id="hasta" type="date" name="hasta" defaultValue={hasta} className={inputClass} /></FilterField>
        </>}>
          <FilterField name="q" label="Jugador"><input id="q" name="q" type="search" defaultValue={q} className={inputClass} placeholder="Nombre del jugador…" /></FilterField>
          <FilterSelect name="liga" label="Liga" value={liga} all="Todas las ligas" options={ctx.leagues.map((l) => ({ value: l.id, label: l.name }))} />
          <SearchableFilter name="equipo" label="Equipo" value={equipo} all="Todos los equipos" options={formData.teams.map((t) => ({ value: t.id, label: t.name }))} />
          <FilterSelect name="estado" label="Estado" value={estado} all="Todos los estados" options={Object.entries(SANCTION_STATUS).map(([value, v]) => ({ value, label: v.label }))} />
        </FilterPanel>
        {sanctions.length === 0 ? (
          <EmptyState
            title={total > 0 ? "No hay sanciones en esta página" : seasonTotal > 0 ? "No hay sanciones con estos filtros" : "Sin sanciones registradas"}
            description={seasonTotal > 0 ? "Amplía las fechas o quita algún filtro para encontrar otros registros." : "Aquí podrás consultar las sanciones y dar seguimiento a su cumplimiento."}
            action={<LinkButton href={total > 0 ? withParams("/sanciones", base) : seasonTotal > 0 ? "/sanciones" : "/jugadores"} variant="secondary">{total > 0 ? "Volver a la primera página" : seasonTotal > 0 ? "Quitar filtros" : "Ver jugadores"}</LinkButton>}
          />
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
