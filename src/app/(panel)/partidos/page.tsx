import Link from "next/link";
import type { MatchStatus, MatchType, Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { MATCH_INCLUDE, sortMatches } from "@/server/services/matches";
import { Badge, buttonClass, Card, EmptyState, inputClass, LinkButton, PageHeader, Pagination, Table, TD, TH, withParams } from "@/components/ui/core";
import { ScoreText, StatusBadge, TeamLink, TypeBadge } from "@/components/match-ui";
import { formatShort, fromISODate, todayISO } from "@/lib/dates";
import { MATCH_STATUS, MATCH_TYPE } from "@/lib/labels";
import { int, str, type SP } from "@/lib/params";

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
        <form className="border-b border-zinc-100 px-4 py-3 sm:px-5" role="search">
          <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-5">
            <div>
              <label htmlFor="fecha" className="mb-1 block text-xs font-semibold text-zinc-700">Fecha</label>
              <input id="fecha" type="date" name="fecha" defaultValue={fecha} className={inputClass} />
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
              <select id="estado" name="estado" defaultValue={estado ?? ""} className={inputClass}>
                <option value="">Todos</option>
                {Object.entries(MATCH_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button className={buttonClass("dark")}>Buscar</button>
              <Link href="/partidos" className={buttonClass("ghost")}>Limpiar</Link>
            </div>
          </div>
          <details className="mt-2" open={!!(jornada || tipo || conflictos)}>
            <summary className="cursor-pointer text-xs font-semibold text-zinc-500 hover:text-zinc-800">Más filtros</summary>
            <div className="mt-2 grid grid-cols-2 items-end gap-3 md:grid-cols-5">
              <div>
                <label htmlFor="jornada" className="mb-1 block text-xs font-semibold text-zinc-700">Jornada</label>
                <select id="jornada" name="jornada" defaultValue={jornada ?? ""} className={inputClass}>
                  <option value="">Todas</option>
                  {rounds.map((r) => <option key={r.id} value={r.number}>J{r.number} · {formatShort(r.date)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="tipo" className="mb-1 block text-xs font-semibold text-zinc-700">Tipo</label>
                <select id="tipo" name="tipo" defaultValue={tipo ?? ""} className={inputClass}>
                  <option value="">Todos</option>
                  {Object.entries(MATCH_TYPE).map(([k, v]) => <option key={k} value={k}>{v.short}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-1.5 pb-2 text-xs"><input type="checkbox" name="conflictos" value="1" defaultChecked={conflictos} className="accent-brand-700" /> Solo con alertas</label>
            </div>
          </details>
        </form>
        {pageItems.length === 0 ? (
          <EmptyState title="No hay partidos que coincidan" />
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
