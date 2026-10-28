import type { MatchStatus, MatchType, Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { MATCH_INCLUDE, sortMatches } from "@/server/services/matches";
import { Badge, Card, EmptyState, inputClass, LinkButton, PageHeader, Pagination, Table, TD, TH, withParams } from "@/components/ui/core";
import { ScoreText, StatusBadge, TeamLink, TypeBadge } from "@/components/match-ui";
import { formatShort, fromISODate, todayISO } from "@/lib/dates";
import { MATCH_STATUS, MATCH_TYPE } from "@/lib/labels";
import { int, str, type SP } from "@/lib/params";

import { FilterField, FilterPanel, FilterSelect } from "@/components/ui/filters";
import { SearchableFilter } from "@/components/ui/SearchableFilter";

export const metadata = { title: "Partidos" };
const SIZE = 50;

export default async function PartidosPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Sin temporada" />;
  const sp = await searchParams;
  const fecha = str(sp.fecha);
  const jornada = str(sp.jornada);
  const liga = str(sp.liga);
  const equipo = str(sp.equipo);
  const estado = str(sp.estado);
  const tipo = str(sp.tipo);
  const conflictos = str(sp.conflictos) === "1";
  const page = int(sp.page, 1);

  const today = fromISODate(todayISO());
  const and: Prisma.MatchWhereInput[] = [{ seasonId: ctx.id }];
  if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) and.push({ date: fromISODate(fecha) });
  if (jornada) and.push({ round: { number: Number(jornada), phase: "REGULAR" } });
  if (liga) and.push({ OR: [{ leagueId: liga }, { homeTeam: { leagueId: liga } }, { awayTeam: { leagueId: liga } }] });
  if (equipo) and.push({ OR: [{ homeTeamId: equipo }, { awayTeamId: equipo }] });
  if (estado && estado in MATCH_STATUS) and.push({ status: estado as MatchStatus });
  if (tipo && tipo in MATCH_TYPE) and.push({ type: tipo as MatchType });
  if (conflictos) and.push({ status: { in: ["PROGRAMADO", "REPROGRAMADO", "PENDIENTE"] }, OR: [{ date: { gte: today } }, { date: null }] });
  const where: Prisma.MatchWhereInput = { AND: and };
  let matches = sortMatches(await prisma.match.findMany({ where, include: { ...MATCH_INCLUDE, homeTeam: { select: { id: true, name: true, leagueId: true, active: true } }, awayTeam: { select: { id: true, name: true, leagueId: true, active: true } } } }));

  if (conflictos) {
    matches = matches.filter((m) => !m.homeTeam.active || !m.awayTeam.active || m.status === "PENDIENTE");
  }
  const total = matches.length;
  const pageItems = matches.slice((page - 1) * SIZE, page * SIZE);
  const [teams, rounds] = await Promise.all([
    prisma.team.findMany({ where: { seasonId: ctx.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.round.findMany({ where: { seasonId: ctx.id, phase: "REGULAR" }, orderBy: { number: "asc" } }),
  ]);
  const base = { fecha, jornada, liga, equipo, estado, tipo, conflictos: conflictos ? "1" : undefined };

  const seasonTotal = total || await prisma.match.count({ where: { seasonId: ctx.id } });

  return (
    <>
      <PageHeader
        title="Partidos"
        actions={
          <>
            {fecha && (
              <>
                <LinkButton href={`/reportes?rol=${fecha}&resultados=${fecha}`} variant="secondary">PDF de esta fecha</LinkButton>
                <LinkButton href={`/partidos/completar?fecha=${fecha}`} variant="secondary">Completar jornada</LinkButton>
              </>
            )}
            <LinkButton href={withParams("/partidos/nuevo", { fecha })}>
              <Plus className="h-4 w-4" /> Nuevo partido
            </LinkButton>
          </>
        }
      />
      <Card>
        <FilterPanel key={JSON.stringify(base)} path="/partidos" params={base} total={total} chips={[
          { name: "fecha", label: "Fecha", value: fecha ? formatShort(fecha) : undefined },
          { name: "liga", label: "Liga", value: liga ? ctx.leagues.find((l) => l.id === liga)?.name ?? "Selección no disponible" : undefined },
          { name: "equipo", label: "Equipo", value: equipo ? teams.find((t) => t.id === equipo)?.name ?? "Selección no disponible" : undefined },
          { name: "estado", label: "Estado", value: estado && estado in MATCH_STATUS ? MATCH_STATUS[estado as MatchStatus].label : undefined },
          { name: "jornada", label: "Jornada", value: jornada },
          { name: "tipo", label: "Tipo", value: tipo && tipo in MATCH_TYPE ? MATCH_TYPE[tipo as MatchType].short : undefined },
          { name: "conflictos", label: "Alertas", value: conflictos ? "Solo con alertas" : undefined },
        ]} advancedOpen={!!(jornada || tipo || conflictos)} advanced={<>
          <FilterSelect name="jornada" label="Jornada" value={jornada} all="Todas las jornadas" options={rounds.map((r) => ({ value: String(r.number), label: `J${r.number} · ${formatShort(r.date)}` }))} />
          <FilterSelect name="tipo" label="Tipo de partido" value={tipo} options={Object.entries(MATCH_TYPE).map(([value, v]) => ({ value, label: v.short }))} />
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"><input type="checkbox" name="conflictos" value="1" defaultChecked={conflictos} className="h-4 w-4 accent-blue-800" />Solo con alertas</label>
        </>}>
          <FilterField name="fecha" label="Fecha"><input id="fecha" type="date" name="fecha" defaultValue={fecha} className={inputClass} /></FilterField>
          <FilterSelect name="liga" label="Liga" value={liga} all="Todas las ligas" options={ctx.leagues.map((l) => ({ value: l.id, label: l.name }))} />
          <SearchableFilter name="equipo" label="Equipo" value={equipo} all="Todos los equipos" options={teams.map((t) => ({ value: t.id, label: t.name }))} />
          <FilterSelect name="estado" label="Estado" value={estado} all="Todos los estados" options={Object.entries(MATCH_STATUS).map(([value, v]) => ({ value, label: v.label }))} />
        </FilterPanel>
        {pageItems.length === 0 ? (
          <EmptyState
            title={total > 0 ? "No hay partidos en esta página" : seasonTotal > 0 ? "No hay partidos con estos filtros" : "Todavía no hay partidos"}
            description={seasonTotal > 0 ? "Prueba otra búsqueda o quita alguno de los filtros aplicados." : teams.length < 2 ? "Registra los equipos participantes para preparar la primera jornada." : "Prepara el calendario o registra el primer encuentro de la temporada."}
            action={<LinkButton href={total > 0 ? withParams("/partidos", base) : seasonTotal > 0 ? "/partidos" : teams.length < 2 ? "/equipos" : "/calendario"} variant="secondary">{total > 0 ? "Volver a la primera página" : seasonTotal > 0 ? "Quitar filtros" : teams.length < 2 ? "Registrar equipos" : "Preparar calendario"}</LinkButton>}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <TH>Fecha</TH><TH>Hora</TH><TH>Cancha</TH><TH>Liga</TH><TH>Local</TH><TH className="text-center">Marcador</TH><TH>Visitante</TH><TH>Estado</TH><TH />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((m) => (
                <tr key={m.id} className={`hover:bg-zinc-50 ${m.status === "CANCELADO" ? "text-zinc-400" : ""}`}>
                  <TD className="whitespace-nowrap">
                    {formatShort(m.date)}
                    <span className="block text-[11px] text-zinc-500">{m.round ? (m.round.phase === "REGULAR" ? `J${m.round.number}` : m.stage) : ""}</span>
                  </TD>
                  <TD className="tabular-nums">{m.timeSlot?.startTime ?? "—"}</TD>
                  <TD className="whitespace-nowrap">{m.field?.name ?? "—"}</TD>
                  <TD className="text-zinc-600">{m.league?.name ?? "—"}</TD>
                  <TD>
                    <TeamLink id={m.homeTeam.id} name={m.homeTeam.name} winner={m.result?.winnerTeamId === m.homeTeamId} />
                    {!m.homeTeam.active && <Badge className="ml-1">baja</Badge>}
                  </TD>
                  <TD className="text-center"><ScoreText result={m.result} homeTeamId={m.homeTeamId} /></TD>
                  <TD>
                    <TeamLink id={m.awayTeam.id} name={m.awayTeam.name} winner={m.result?.winnerTeamId === m.awayTeamId} />
                    {!m.awayTeam.active && <Badge className="ml-1">baja</Badge>}
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge status={m.status} />
                      <TypeBadge type={m.type} counts={m.countsForStandings} />
                      {(m.locked || m.round?.locked) && m.status !== "JUGADO" && <Badge className="bg-sky-50 text-sky-800 ring-sky-200">protegido</Badge>}
                    </div>
                  </TD>
                  <TD className="text-right">
                    <LinkButton href={`/partidos/${m.id}`} size="sm" variant="secondary">Abrir</LinkButton>
                  </TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination page={page} pageCount={Math.ceil(total / SIZE)} total={total} hrefFor={(p) => withParams("/partidos", { ...base, page: p })} />
      </Card>
    </>
  );
}
