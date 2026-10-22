import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { createTeamAction, importTeamsCsvAction } from "@/server/actions/teams";
import { CsvImportButton, TeamCreateButton } from "@/components/forms/entity-forms";
import { Badge, buttonClass, Card, EmptyState, inputClass, LinkButton, PageHeader, Pagination, SortTH, Table, TD, TH, withParams } from "@/components/ui/core";
import { PAGE_SIZE, int, str, type SP } from "@/lib/params";
import { normalizeName } from "@/domain/text";

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
        <form className="flex flex-wrap items-end gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5" role="search">
          <div className="min-w-48 flex-1">
            <label htmlFor="q" className="mb-1 block text-xs font-semibold text-zinc-700">
              Buscar
            </label>
            <input id="q" name="q" defaultValue={q} placeholder="Nombre del equipo" className={inputClass} />
          </div>
          <div>
            <label htmlFor="liga" className="mb-1 block text-xs font-semibold text-zinc-700">
              Liga
            </label>
            <select id="liga" name="liga" defaultValue={liga ?? ""} className={inputClass}>
              <option value="">Todas</option>
              {ctx.leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="estado" className="mb-1 block text-xs font-semibold text-zinc-700">
              Estado
            </label>
            <select id="estado" name="estado" defaultValue={estado} className={inputClass}>
              <option value="activos">Activos</option>
              <option value="inactivos">Dados de baja</option>
              <option value="todos">Todos</option>
            </select>
          </div>
          <button className={buttonClass("dark")}>Filtrar</button>
        </form>
        {teams.length === 0 ? (
          <EmptyState title="No hay equipos que coincidan" description="Ajusta los filtros o registra un equipo nuevo." />
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
