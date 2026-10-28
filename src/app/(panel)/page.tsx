import Link from "next/link";
import { AlertTriangle, ChevronRight, Info } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getSeasonId } from "@/server/season";
import { getDashboard } from "@/server/services/dashboard";
import { matchDays } from "@/server/services/matchdays";
import { WhatsAppPdfs } from "@/components/WhatsAppPdfs";
import { Card, EmptyState, LinkButton } from "@/components/ui/core";
import { todayISO } from "@/lib/dates";
import { DashboardOverview } from "@/components/dashboard/Overview";
import { cn } from "@/components/ui/core";

export const metadata = { title: "Inicio" };

/** Texto oscuro o claro según el color de fondo de la zona. */
function textOn(hex: string) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150 ? "#111" : "#fff";
}

export default async function DashboardPage() {
  await requireUser();
  const seasonId = await getSeasonId();
  if (!seasonId) {
    return (
      <Card>
        <EmptyState
          title="No hay temporadas configuradas"
          action={<LinkButton href="/configuracion/temporadas">Crear temporada</LinkButton>}
        />
      </Card>
    );
  }
  const [d, days] = await Promise.all([getDashboard(seasonId), matchDays(seasonId)]);
  // Solo las ligas que ya tienen equipos: evita tarjetas vacías.
  const leagues = d.leagues.filter((l) => l.activeTeams > 0);
  const t = d.totals;
  const progress = {
    activeLeagues: d.leagues.length,
    activeTeams: d.leagues.reduce((sum, league) => sum + league.activeTeams, 0),
    hasMatches: d.hasMatches,
    hasDraft: d.hasDraft,
    pendingResult: t.pendingResult,
    pendingResultDate: d.pendingResultDate,
    unscheduled: t.unscheduled,
    played: t.played,
    nextDate: d.nextDate,
    today: todayISO(),
  };

  return (
    <div className="space-y-6">
      <DashboardOverview
        seasonName={d.season.name}
        progress={progress}
        totals={t}
        teamsByLeague={leagues.map((l) => `${l.league.name}: ${l.activeTeams} activos`).join(" · ")}
      />

      {/* Alertas: solo si existen */}
      {d.alerts.length > 0 && (
        <ul className="space-y-2" aria-label="Alertas">
          {d.alerts.map((a, i) => (
            <li key={i}>
              <Link
                href={a.href ?? "#"}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700",
                  a.tone === "danger" && "bg-red-50 text-red-900 ring-red-200 hover:bg-red-100",
                  a.tone === "warn" && "bg-amber-50 text-amber-900 ring-amber-200 hover:bg-amber-100",
                  a.tone === "info" && "bg-sky-50 text-sky-900 ring-sky-200 hover:bg-sky-100",
                )}
              >
                {a.tone === "info" ? <Info className="h-4 w-4 shrink-0" aria-hidden /> : <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />}
                <span className="flex-1">{a.text}</span>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* PDF para WhatsApp, uno por liga */}
      {leagues.length > 0 && (
      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-bold text-zinc-900">Para enviar por WhatsApp</h2>
          <Link href="/reportes" className="text-sm font-semibold text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">
            Elegir otra fecha
          </Link>
        </div>
        <WhatsAppPdfs leagues={leagues.map(({ league }) => ({ id: league.id, name: league.name }))} rolDate={days.rolDate} resultsDate={days.resultsDate} />
      </section>
      )}

      {/* Tabla y goleo por liga */}
      <div className="grid gap-5 xl:grid-cols-2">
        {leagues.map(({ league, standings, scorers }) => (
          <Card key={league.id}>
            <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
              <h2 className="font-display text-lg text-zinc-900">{league.name}</h2>
              <Link href={`/tabla?liga=${league.id}`} className="text-sm font-semibold text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">
                Tabla completa
              </Link>
            </div>
            {standings.rows.length === 0 ? (
              <EmptyState title="Sin equipos registrados" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-zinc-500">
                    <th className="w-12 px-5 py-1.5 text-left">Pos</th>
                    <th className="py-1.5 text-left">Equipo</th>
                    <th className="w-14 py-1.5 text-center">JJ</th>
                    <th className="w-16 px-5 py-1.5 text-right">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.rows.slice(0, 5).map((r) => (
                    <tr key={r.teamId} className="border-t border-zinc-100">
                      <td className="px-5 py-2">
                        <span
                          className="inline-grid h-6 w-6 place-items-center rounded text-xs font-bold"
                          style={r.zone ? { background: r.zone.color, color: textOn(r.zone.color) } : { background: "#f4f4f5" }}
                        >
                          {r.position}
                        </span>
                      </td>
                      <td className="py-2 font-semibold text-zinc-900">{r.teamName}</td>
                      <td className="py-2 text-center text-zinc-600 tabular-nums">{r.jj}</td>
                      <td className="px-5 py-2 text-right font-extrabold tabular-nums">{r.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-2 border-t border-zinc-100 px-5 py-3">
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-zinc-500">Máximos goleadores</h3>
                <Link href={`/goleo?liga=${league.id}`} className="text-xs font-semibold text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">
                  Ver goleo
                </Link>
              </div>
              {scorers.length === 0 ? (
                <p className="text-sm text-zinc-500">Sin goles registrados.</p>
              ) : (
                <ol className="space-y-1 text-sm">
                  {scorers.map((s) => (
                    <li key={s.playerId} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate">
                        <span className="font-semibold text-zinc-900">{s.playerName}</span>
                        <span className="text-zinc-500"> · {s.teamLabel}</span>
                      </span>
                      <span className="font-extrabold text-blue-800 tabular-nums">{s.goals}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
