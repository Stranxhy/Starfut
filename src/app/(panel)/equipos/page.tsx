import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { createTeamAction, importTeamsCsvAction } from "@/server/actions/teams";
import { CsvImportButton, TeamCreateButton } from "@/components/forms/entity-forms";
import { Badge, Card, EmptyState, inputClass, LinkButton, PageHeader, Pagination, SortTH, Table, TD, TH, withParams } from "@/components/ui/core";
import { PAGE_SIZE, int, str, type SP } from "@/lib/params";
import { normalizeName } from "@/domain/text";

import { FilterField, FilterPanel, FilterSelect } from "@/components/ui/filters";

export const metadata = { title: "Equipos" };

export default async function EquiposPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Sin temporada" />;
  const sp = await searchParams;
  const q = str(sp.q);
  const liga = str(sp.liga);
  const estado = str(sp.estado) ?? "activos";
  const sort = str(sp.sort) ?? "name";
  const dir = str(sp.dir) === "desc" ? "desc" : "asc";
  const page = int(sp.page, 1);

  const where: Prisma.TeamWhereInput = {
    seasonId: ctx.id,
    ...(liga ? { leagueId: liga } : {}),
    ...(estado === "activos" ? { active: true } : estado === "inactivos" ? { active: false } : {}),
    ...(q ? { nameKey: { contains: normalizeName(q) } } : {}),
  };
  const orderBy: Prisma.TeamOrderByWithRelationInput[] =
    sort === "league" ? [{ league: { sortOrder: dir } }, { name: "asc" }] : sort === "created" ? [{ createdAt: dir }] : [{ name: dir }];
  const [total, teams] = await Promise.all([
    prisma.team.count({ where }),
    prisma.team.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { league: { select: { name: true } }, _count: { select: { players: { where: { active: true } } } } },
    }),
  ]);
  const leagueOpts = ctx.leagues.map((l) => ({ value: l.id, label: l.name }));
  const base = { q, liga, estado, sort, dir };
  const href = (p: Record<string, string | number | undefined>) => withParams("/equipos", { ...base, ...p });

  const seasonTotal = total || await prisma.team.count({ where: { seasonId: ctx.id } });

  return (
    <>
      <PageHeader
        title="Equipos"
        actions={
          <>
            <LinkButton href={withParams("/api/pdf/equipos", { league: liga })} target="_blank" variant="secondary">
              PDF
            </LinkButton>
            <CsvImportButton
              action={importTeamsCsvAction}
              title="Importar equipos desde CSV"
              columns="nombre, liga, contacto, telefono, correo"
              example={"nombre,liga,contacto,telefono,correo\nVenus FC,Premium,Juan Pérez,5512345678,"}
              defaultSelect={{ name: "leagueId", label: "Liga por defecto (si el archivo no la indica)", options: leagueOpts }}
            />
            <TeamCreateButton action={createTeamAction} leagues={leagueOpts} />
          </>
        }
      />
      <Card>
        <FilterPanel key={JSON.stringify(base)} path="/equipos" params={base} total={total} preserve={["sort", "dir"]} chips={[
          { name: "q", label: "Nombre", value: q },
          { name: "liga", label: "Liga", value: liga ? ctx.leagues.find((l) => l.id === liga)?.name ?? "Selección no disponible" : undefined },
          { name: "estado", label: "Estado", value: estado === "activos" ? "Activos" : estado === "inactivos" ? "Dados de baja" : undefined, resetValue: "todos" },
        ]}>
          <FilterField name="q" label="Equipo"><input id="q" name="q" type="search" defaultValue={q} placeholder="Nombre del equipo…" className={inputClass} /></FilterField>
          <FilterSelect name="liga" label="Liga" value={liga} all="Todas las ligas" options={leagueOpts} />
          <FilterSelect name="estado" label="Estado" value={estado} all={false} options={[{ value: "activos", label: "Activos" }, { value: "inactivos", label: "Dados de baja" }, { value: "todos", label: "Todos" }]} />
        </FilterPanel>
        {teams.length === 0 ? (
          <EmptyState
            title={total > 0 ? "No hay equipos en esta página" : seasonTotal > 0 ? "No hay equipos con estos filtros" : "Registra los primeros equipos"}
            description={seasonTotal > 0 ? "Puedes cambiar la liga, buscar otro nombre o incluir equipos dados de baja." : "Agrega los equipos de cada liga para empezar a organizar los partidos."}
            action={seasonTotal > 0 ? (
              <LinkButton href={total > 0 ? withParams("/equipos", base) : "/equipos?estado=todos"} variant="secondary">
                {total > 0 ? "Volver a la primera página" : "Ver todos los equipos"}
              </LinkButton>
            ) : <TeamCreateButton action={createTeamAction} leagues={leagueOpts} />}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <SortTH label="Equipo" field="name" sort={sort} dir={dir} hrefFor={(s, d) => href({ sort: s, dir: d, page: 1 })} />
                <SortTH label="Liga" field="league" sort={sort} dir={dir} hrefFor={(s, d) => href({ sort: s, dir: d, page: 1 })} />
                <TH className="text-center">Jugadores</TH>
                <TH>Estado</TH>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-50">
                  <TD className="font-semibold">
                    <Link href={`/equipos/${t.id}`} className="hover:text-brand-700 hover:underline">
                      {t.name}
                    </Link>
                    {t.isDemo && <Badge className="ml-2 bg-amber-100 text-amber-900 ring-amber-300">Demo</Badge>}
                  </TD>
                  <TD>{t.league.name}</TD>
                  <TD className="text-center tabular-nums">{t._count.players}</TD>
                  <TD>{t.active ? <Badge className="bg-emerald-100 text-emerald-900 ring-emerald-300">Activo</Badge> : <Badge>Baja</Badge>}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} total={total} hrefFor={(p) => href({ page: p })} />
      </Card>
    </>
  );
}
