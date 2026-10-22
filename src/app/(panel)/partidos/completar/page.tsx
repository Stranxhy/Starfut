import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { proposeDayFill } from "@/server/services/matches";
import { fillDayAction } from "@/server/actions/matches";
import { FillDayForm } from "@/components/forms/FillDayForm";
import { Alert, Card, CardHeader, EmptyState, LinkButton, PageHeader } from "@/components/ui/core";
import { formatLong, formatShort, fromISODate, todayISO, toISODate } from "@/lib/dates";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Completar jornada" };

export default async function CompletarJornadaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Sin temporada" />;
  const sp = await searchParams;
  const dates = (
    await prisma.match.groupBy({ by: ["date"], where: { seasonId: ctx.id, date: { gte: fromISODate(todayISO()) } }, orderBy: { date: "asc" } })
  )
    .map((d) => toISODate(d.date))
    .filter((d): d is string => !!d);
  const date = str(sp.fecha) ?? dates[0];
  if (!date) {
    return (
      <>
        <PageHeader title="Completar jornada" breadcrumb={[{ href: "/partidos", label: "Partidos" }]} />
        <Card>
          <EmptyState title="No hay fechas próximas programadas" />
        </Card>
      </>
    );
  }
  const { teams, pairs, unpaired } = await proposeDayFill(ctx.id, date);
  const closed = await prisma.standingSnapshot.findMany({ where: { kind: "CIERRE_FASE_REGULAR", league: { seasonId: ctx.id } }, select: { leagueId: true } });
  const closedIds = new Set(closed.map((c) => c.leagueId));
  const friendly = teams.some((t) => closedIds.has(t.leagueId));
  const byLeague = ctx.leagues
    .map((l) => ({ name: l.name, teams: teams.filter((t) => t.leagueId === l.id) }))
    .filter((g) => g.teams.length);

  return (
    <>
      <PageHeader
        title="Completar jornada"
        breadcrumb={[{ href: `/partidos?fecha=${date}`, label: "Partidos" }]}
        description={formatLong(date)}
        actions={
          <>
            {ctx.leagues.map((l) => (
              <LinkButton key={l.id} href={`/api/pdf/rol?date=${date}&league=${l.id}`} target="_blank" variant="secondary">
                Rol {l.name}
              </LinkButton>
            ))}
          </>
        }
      />
      <form className="mb-4 flex items-center gap-2 text-sm">
        <label htmlFor="fecha" className="font-semibold text-zinc-600">Fecha</label>
        <select id="fecha" name="fecha" defaultValue={date} className="rounded-lg py-1.5 ring-1 ring-zinc-300">
          {(dates.includes(date) ? dates : [date, ...dates]).map((d) => (
            <option key={d} value={d}>{formatShort(d)}</option>
          ))}
        </select>
        <button className="rounded-lg bg-zinc-900 px-3 py-1.5 font-semibold text-white">Ver</button>
      </form>

      {teams.length === 0 ? (
        <Card>
          <EmptyState title="Todos los equipos tienen partido" description="No hace falta combinar equipos en esta fecha." />
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[18rem_1fr]">
          <Card>
            <CardHeader title={`Sin partido (${teams.length})`} />
            <div className="space-y-4 px-5 py-4">
              {byLeague.map((g) => (
                <div key={g.name}>
                  <p className="mb-1 text-xs font-semibold text-zinc-500">{g.name}</p>
                  <ul className="space-y-1 text-sm">
                    {g.teams.map((t) => (
                      <li key={t.id} className="flex justify-between gap-2">
                        <span className="font-semibold text-zinc-900">{t.name}</span>
                        <span className="text-xs text-zinc-500">{t.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Partidos propuestos" description="Primero dentro de la misma liga; los equipos que sobran se combinan entre ligas." />
            <div className="px-5 py-4">
              {pairs.length > 0 ? (
                <FillDayForm action={fillDayAction} date={date} pairs={pairs} friendly={friendly} />
              ) : (
                <p className="text-sm text-zinc-600">No hay suficientes equipos para formar un partido.</p>
              )}
              {unpaired.length > 0 && (
                <Alert tone="warn" className="mt-4">
                  Sin rival disponible: {unpaired.map((t) => t.name).join(", ")}. Puedes programarlo a mano desde Partidos → Nuevo partido.
                </Alert>
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
