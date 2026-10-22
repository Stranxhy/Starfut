import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { MATCH_INCLUDE, sortMatches } from "@/server/services/matches";
import { getScoringRules } from "@/server/services/rules";
import { saveResultAction } from "@/server/actions/results";
import { ResultForm } from "@/components/forms/ResultForm";
import { Alert, Card, CardHeader, EmptyState, LinkButton, PageHeader } from "@/components/ui/core";
import { StatusBadge, TypeBadge } from "@/components/match-ui";
import { formatLong, formatShort, fromISODate, todayISO, toISODate } from "@/lib/dates";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Resultados" };

export default async function ResultadosPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Sin temporada" />;
  const sp = await searchParams;
  const today = todayISO();

  const byDate = await prisma.match.groupBy({
    by: ["date", "status"],
    where: { seasonId: ctx.id, date: { not: null }, status: { not: "CANCELADO" } },
    _count: true,
  });
  const dates = new Map<string, { total: number; pending: number }>();
  for (const g of byDate) {
    const d = toISODate(g.date)!;
    const cur = dates.get(d) ?? { total: 0, pending: 0 };
    cur.total += g._count;
    if (g.status !== "JUGADO" && g.status !== "PENDIENTE") cur.pending += g._count;
    dates.set(d, cur);
  }
  const sorted = [...dates.keys()].sort();
  const firstPending = sorted.find((d) => d <= today && (dates.get(d)?.pending ?? 0) > 0);
  const lastPast = [...sorted].reverse().find((d) => d <= today);
  const selected = str(sp.date) ?? firstPending ?? lastPast ?? sorted[0];

  const matches = selected
    ? sortMatches(
        await prisma.match.findMany({
          where: { seasonId: ctx.id, date: fromISODate(selected), status: { not: "CANCELADO" } },
          include: MATCH_INCLUDE,
        }),
      )
    : [];
  const rules = await getScoringRules(ctx.id, null);
  const pendingCount = matches.filter((m) => !m.result).length;
  const idx = selected ? sorted.indexOf(selected) : -1;

  return (
    <>
      <PageHeader
        title="Resultados"
        actions={
          selected ? (
            <>
              <LinkButton href={`/api/pdf/resultados?date=${selected}`} target="_blank" variant="secondary">PDF resultados</LinkButton>
              <LinkButton href="/tabla" variant="secondary">Ver tabla</LinkButton>
            </>
          ) : undefined
        }
      />
      {sorted.length === 0 ? (
        <Card><EmptyState title="Sin partidos programados" description="Genera el calendario para capturar resultados." /></Card>
      ) : (
        <>
          <Card className="mb-4">
            <form className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
              {idx > 0 && <LinkButton href={`/resultados?date=${sorted[idx - 1]}`} size="sm" variant="secondary">← {formatShort(sorted[idx - 1])}</LinkButton>}
              <label htmlFor="date" className="text-xs font-semibold text-zinc-600">Fecha</label>
              <select id="date" name="date" defaultValue={selected} className="rounded-lg py-1.5 text-sm ring-1 ring-zinc-300">
                {sorted.map((d) => {
                  const info = dates.get(d)!;
                  return (
                    <option key={d} value={d}>
                      {formatShort(d)} · {info.total} partidos{info.pending && d <= today ? ` · ${info.pending} sin resultado` : ""}
                    </option>
                  );
                })}
              </select>
              <button className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white">Ir</button>
              {idx < sorted.length - 1 && <LinkButton href={`/resultados?date=${sorted[idx + 1]}`} size="sm" variant="secondary">{formatShort(sorted[idx + 1])} →</LinkButton>}
            </form>
          </Card>
          {selected && selected > today && (
            <Alert tone="info" className="mb-4">Esta fecha aún no se disputa. Puedes capturar resultados cuando terminen los partidos.</Alert>
          )}
          <Card>
            <CardHeader title={selected ? formatLong(selected) : ""} description={`${matches.length} partido(s) · ${pendingCount} sin resultado`} />
            <ul className="divide-y divide-zinc-100">
              {matches.map((m) => (
                <li key={m.id} className="px-4 py-3 sm:px-5">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span className="font-bold text-zinc-700 tabular-nums">{m.timeSlot?.startTime ?? "—"}</span>
                    <span>{m.field?.name ?? "Sin cancha"}</span>
                    <span>· {m.league?.name}</span>
                    {m.round?.phase === "REGULAR" ? <span>· J{m.round.number}</span> : <span>· {m.stage}</span>}
                    <StatusBadge status={m.status} />
                    <TypeBadge type={m.type} counts={m.countsForStandings} />
                    <Link href={`/resultados/${m.id}`} className="ml-auto font-semibold text-brand-700 hover:underline">Detalle y goleadores →</Link>
                  </div>
                  {m.status === "PENDIENTE" ? (
                    <p className="text-sm text-zinc-600">
                      {m.homeTeam.name} vs {m.awayTeam.name}: partido sin programar. <Link className="text-brand-700 hover:underline" href={`/partidos/${m.id}`}>Programar</Link>
                    </p>
                  ) : (
                    <ResultForm
                      compact
                      action={saveResultAction}
                      match={{ id: m.id, homeTeam: m.homeTeam, awayTeam: m.awayTeam, isPlayoff: m.stage !== "REGULAR" }}
                      existing={m.result}
                      rules={{ allowDraws: rules.allowDraws, drawPoints: rules.drawPoints, shootoutKicks: rules.shootoutKicks }}
                    />
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
