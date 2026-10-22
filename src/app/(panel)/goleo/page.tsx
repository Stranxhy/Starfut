import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { getLeagueScorers } from "@/server/services/standings";
import { getTiebreakers } from "@/server/services/rules";
import { SCORER_CRITERIA } from "@/domain/scorers";
import { Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, Table, TD, TH, withParams } from "@/components/ui/core";
import { formatLong } from "@/lib/dates";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Tabla de goleo" };

export default async function GoleoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx || ctx.leagues.length === 0) return <EmptyState title="Sin ligas configuradas" />;
  const sp = await searchParams;
  const league = ctx.leagues.find((l) => l.id === str(sp.liga)) ?? ctx.leagues[0];
  const round = str(sp.jornada) ? Number(str(sp.jornada)) : undefined;
  const includePlayoffs = str(sp.eliminatorias) === "1";
  const [scorers, tb, rounds] = await Promise.all([
    getLeagueScorers(league.id, { includePlayoffs, upToRound: round }),
    getTiebreakers(ctx.id, league.id),
    prisma.round.findMany({ where: { seasonId: ctx.id, phase: "REGULAR" }, orderBy: { number: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Tabla de goleo"
        actions={<LinkButton href={withParams("/api/pdf/goleo", { league: league.id, round })} target="_blank">Generar PDF</LinkButton>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {ctx.leagues.map((l) => (
          <Link key={l.id} href={`/goleo?liga=${l.id}`} className={`rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ${l.id === league.id ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-zinc-700 ring-zinc-300 hover:ring-brand-400"}`}>
            {l.name}
          </Link>
        ))}
        <form className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          <input type="hidden" name="liga" value={league.id} />
          <label htmlFor="jornada" className="font-semibold text-zinc-600">Hasta la jornada</label>
          <select id="jornada" name="jornada" defaultValue={round ?? ""} className="rounded-lg py-1.5 ring-1 ring-zinc-300">
            <option value="">Todas</option>
            {rounds.map((r) => <option key={r.id} value={r.number}>{r.number}</option>)}
          </select>
          <label className="flex items-center gap-1"><input type="checkbox" name="eliminatorias" value="1" defaultChecked={includePlayoffs} className="accent-brand-700" /> Incluir eliminatorias</label>
          <button className="rounded-lg bg-zinc-900 px-3 py-1.5 font-semibold text-white">Ver</button>
        </form>
      </div>
      <Card>
        <CardHeader
          title={`${league.name} · ${ctx.name}`}
          description={`${scorers.throughRound ? `Jornada ${scorers.throughRound} · ` : ""}${scorers.lastResultDate ? `actualizada al ${formatLong(scorers.lastResultDate)}` : "sin goles registrados"}`}
        />
        {scorers.rows.length === 0 ? (
          <EmptyState title="Sin goles individuales registrados" description="Registra los goleadores desde el detalle de cada resultado." />
        ) : (
          <Table>
            <thead>
              <tr><TH className="w-16 text-center">Lugar</TH><TH>Jugador</TH><TH>Equipo</TH><TH className="text-center">Goles</TH></tr>
            </thead>
            <tbody>
              {scorers.rows.map((r) => (
                <tr key={r.playerId} className={r.position === 1 ? "bg-amber-50" : ""}>
                  <TD className="text-center font-extrabold">{r.position}{r.shared && <span className="text-[10px] font-normal text-zinc-500"> (comp.)</span>}</TD>
                  <TD className="font-semibold"><Link href={`/jugadores/${r.playerId}`} className="hover:underline">{r.playerName}</Link></TD>
                  <TD>{r.teamLabel}{r.teams.length > 1 && <Badge className="ml-2">cambió de equipo</Badge>}</TD>
                  <TD className="text-center text-lg font-extrabold text-brand-700 tabular-nums">{r.goals}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <p className="border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500">
          Desempate entre jugadores: {tb.scorerCriteria.length ? tb.scorerCriteria.map((c) => SCORER_CRITERIA[c]).join(" → ") : "ninguno configurado (posición compartida)"}.{" "}
          <Link href={`/configuracion/reglas?liga=${league.id}`} className="font-semibold text-brand-700 hover:underline">Configurar</Link>
        </p>
      </Card>
    </>
  );
}
