import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { createPlayerAction, importPlayersCsvAction } from "@/server/actions/people";
import { CsvImportButton, PlayerCreateButton } from "@/components/forms/entity-forms";
import { Badge, Card, EmptyState, inputClass, LinkButton, PageHeader, Pagination, SortTH, Table, TD, TH, withParams } from "@/components/ui/core";
import { PAGE_SIZE, int, str, type SP } from "@/lib/params";
import { normalizeName } from "@/domain/text";

import { FilterField, FilterPanel, FilterSelect } from "@/components/ui/filters";
import { SearchableFilter } from "@/components/ui/SearchableFilter";

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

  const seasonTotal = total || await prisma.player.count({ where: { seasonId: ctx.id } });

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
        <FilterPanel key={JSON.stringify(base)} path="/jugadores" params={base} total={total} preserve={["sort", "dir"]} chips={[
          { name: "q", label: "Nombre", value: q },
          { name: "liga", label: "Liga", value: liga ? ctx.leagues.find((l) => l.id === liga)?.name ?? "Selección no disponible" : undefined },
          { name: "equipo", label: "Equipo", value: equipo ? teams.find((t) => t.id === equipo)?.name ?? "Selección no disponible" : undefined },
          { name: "estado", label: "Estado", value: estado === "activos" ? "Activos" : estado === "inactivos" ? "Inactivos" : undefined, resetValue: "todos" },
        ]}>
          <FilterField name="q" label="Jugador"><input id="q" name="q" type="search" defaultValue={q} placeholder="Nombre del jugador…" className={inputClass} /></FilterField>
          <FilterSelect name="liga" label="Liga" value={liga} all="Todas las ligas" options={ctx.leagues.map((l) => ({ value: l.id, label: l.name }))} />
          <SearchableFilter name="equipo" label="Equipo" value={equipo} all="Todos los equipos" options={teamOpts} />
          <FilterSelect name="estado" label="Estado" value={estado} all={false} options={[{ value: "activos", label: "Activos" }, { value: "inactivos", label: "Inactivos" }, { value: "todos", label: "Todos" }]} />
        </FilterPanel>
        {players.length === 0 ? (
          <EmptyState
            title={total > 0 ? "No hay jugadores en esta página" : seasonTotal > 0 ? "No hay jugadores con estos filtros" : "Completa las plantillas"}
            description={seasonTotal > 0 ? "Prueba otro nombre, cambia el equipo o incluye jugadores inactivos." : "Registra a los jugadores de cada equipo para llevar el goleo y las sanciones."}
            action={seasonTotal > 0 ? <LinkButton href={total > 0 ? withParams("/jugadores", base) : "/jugadores?estado=todos"} variant="secondary">{total > 0 ? "Volver a la primera página" : "Ver todos los jugadores"}</LinkButton> : teamOpts.length > 0 ? <PlayerCreateButton action={createPlayerAction} teams={teamOpts} /> : <LinkButton href="/equipos" variant="secondary">Registrar equipos</LinkButton>}
          />
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
