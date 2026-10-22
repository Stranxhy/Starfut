import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { createPlayerAction, importPlayersCsvAction } from "@/server/actions/people";
import { CsvImportButton, PlayerCreateButton } from "@/components/forms/entity-forms";
import { Badge, buttonClass, Card, EmptyState, inputClass, PageHeader, Pagination, SortTH, Table, TD, TH, withParams } from "@/components/ui/core";
import { PAGE_SIZE, int, str, type SP } from "@/lib/params";
import { normalizeName } from "@/domain/text";

export const metadata = { title: "Jugadores" };

export default async function JugadoresPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Sin temporada" />;
  const sp = await searchParams;
  const q = str(sp.q);
  const equipo = str(sp.equipo);
  const liga = str(sp.liga);
  const estado = str(sp.estado) ?? "activos";
  const sort = str(sp.sort) ?? "name";
  const dir = str(sp.dir) === "desc" ? "desc" : "asc";
  const page = int(sp.page, 1);

  const where: Prisma.PlayerWhereInput = {
    seasonId: ctx.id,
    ...(equipo ? { teamId: equipo } : {}),
    ...(liga ? { team: { leagueId: liga } } : {}),
    ...(estado === "activos" ? { active: true } : estado === "inactivos" ? { active: false } : {}),
    ...(q ? { nameKey: { contains: normalizeName(q) } } : {}),
  };
  const orderBy: Prisma.PlayerOrderByWithRelationInput[] =
    sort === "team" ? [{ team: { name: dir } }, { fullName: "asc" }] : sort === "number" ? [{ jerseyNumber: dir }] : [{ fullName: dir }];
  const [total, players, teams] = await Promise.all([
    prisma.player.count({ where }),
    prisma.player.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { team: { select: { id: true, name: true, league: { select: { name: true } } } } },
    }),
    prisma.team.findMany({ where: { seasonId: ctx.id, active: true }, orderBy: { name: "asc" }, include: { league: { select: { name: true } } } }),
  ]);
  const goals = await prisma.matchScorer.groupBy({
    by: ["playerId"],
    where: { playerId: { in: players.map((p) => p.id) }, match: { status: "JUGADO", type: { not: "AMISTOSO" } } },
    _sum: { goals: true },
  });
  const goalMap = new Map(goals.map((g) => [g.playerId, g._sum.goals ?? 0]));
  const teamOpts = teams.map((t) => ({ value: t.id, label: `${t.name} (${t.league.name})` }));
  const base = { q, equipo, liga, estado, sort, dir };
  const href = (p: Record<string, string | number | undefined>) => withParams("/jugadores", { ...base, ...p });

  return (
    <>
      <PageHeader
        title="Jugadores"
        actions={
          <>
            <CsvImportButton
              action={importPlayersCsvAction}
              title="Importar jugadores desde CSV"
              columns="nombre, equipo, numero"
              example={"nombre,equipo,numero\nRuben Arriaga,Venus FC,9"}
              defaultSelect={{ name: "teamId", label: "Equipo por defecto (si el archivo no lo indica)", options: teamOpts }}
            />
            <PlayerCreateButton action={createPlayerAction} teams={teamOpts} defaultTeamId={equipo} />
          </>
        }
      />
      <Card>
        <form className="flex flex-wrap items-end gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5" role="search">
          <div className="min-w-48 flex-1">
            <label htmlFor="q" className="mb-1 block text-xs font-semibold text-zinc-700">Buscar</label>
            <input id="q" name="q" defaultValue={q} placeholder="Nombre del jugador" className={inputClass} />
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
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
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
        {players.length === 0 ? (
          <EmptyState title="No hay jugadores que coincidan" />
        ) : (
          <Table>
            <thead>
              <tr>
                <SortTH label="#" field="number" sort={sort} dir={dir} hrefFor={(s, d) => href({ sort: s, dir: d, page: 1 })} className="w-16" />
                <SortTH label="Jugador" field="name" sort={sort} dir={dir} hrefFor={(s, d) => href({ sort: s, dir: d, page: 1 })} />
                <SortTH label="Equipo" field="team" sort={sort} dir={dir} hrefFor={(s, d) => href({ sort: s, dir: d, page: 1 })} />
                <TH>Liga</TH>
                <TH className="text-center">Goles</TH>
                <TH>Estado</TH>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <TD className="text-zinc-500 tabular-nums">{p.jerseyNumber ?? "—"}</TD>
                  <TD className="font-semibold">
                    <Link href={`/jugadores/${p.id}`} className="hover:text-brand-700 hover:underline">{p.fullName}</Link>
                  </TD>
                  <TD><Link href={`/equipos/${p.team.id}`} className="hover:underline">{p.team.name}</Link></TD>
                  <TD className="text-zinc-600">{p.team.league.name}</TD>
                  <TD className="text-center font-bold tabular-nums">{goalMap.get(p.id) ?? 0}</TD>
                  <TD>{p.active ? <Badge className="bg-emerald-100 text-emerald-900 ring-emerald-300">Activo</Badge> : <Badge>Inactivo</Badge>}</TD>
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
