import Link from "next/link";
import { AlertTriangle, CalendarDays, ChevronRight, ClipboardList, FileDown, Info } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getSeasonId } from "@/server/season";
import { getDashboard } from "@/server/services/dashboard";
import { buttonClass, Card, EmptyState, LinkButton } from "@/components/ui/core";
import { formatLong } from "@/lib/dates";
import { cn } from "@/components/ui/core";

export const metadata = { title: "Dashboard" };

/** Texto oscuro o claro según el color de fondo de la zona. */
function textOn(hex: string) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150 ? "#111" : "#fff";
}

function Figure({ label, value, href, tone, dot }: { label: string; value: React.ReactNode; href: string; tone?: "alert"; dot?: string }) {
  return (
    <Link href={href} className="group flex flex-col gap-1 rounded-lg px-3 py-2.5 transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
        {dot && <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden />}
        {label}
      </span>
      <span className={cn("text-2xl font-extrabold tabular-nums", tone === "alert" ? "text-brand-700" : "text-zinc-900")}>{value}</span>
    </Link>
  );
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
  const d = await getDashboard(seasonId);
  const t = d.totals;
  const matchDay = d.nextDate ?? d.currentRound?.date ?? null;

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Dashboard</h1>

      {/* Jornada y accesos rápidos */}
      <section className="bg-sport overflow-hidden rounded-2xl px-5 py-6 text-white shadow-lg sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-semibold text-white/70">{d.season.name}</p>
            <p className="font-display mt-1 text-4xl leading-none sm:text-5xl">
              {d.currentRound ? `Jornada ${d.currentRound.number}` : "Sin calendario"}
            </p>
            <p className="mt-2 text-base font-medium text-white/90">
              {matchDay ? `Próxima fecha: ${formatLong(matchDay)}` : "Genera el calendario para empezar."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {d.nextDate ? (
              d.leagues.map(({ league }) => (
                <a
                  key={league.id}
                  href={`/api/pdf/rol?date=${d.nextDate}&league=${league.id}`}
                  target="_blank"
                  className={buttonClass("secondary", "md", "ring-0 text-brand-800")}
                >
                  <CalendarDays className="h-4 w-4" /> Rol {league.name}
                </a>
              ))
            ) : (
              <Link href="/calendario" className={buttonClass("secondary", "md", "ring-0 text-brand-800")}>
                <CalendarDays className="h-4 w-4" /> Generar calendario
              </Link>
            )}
            <Link href="/resultados" className={"inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold whitespace-nowrap text-white ring-1 ring-white/50 transition ring-inset hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"}>
              <ClipboardList className="h-4 w-4" /> Registrar resultados
            </Link>
            <Link href="/reportes" className={"inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold whitespace-nowrap text-white ring-1 ring-white/50 transition ring-inset hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"}>
              <FileDown className="h-4 w-4" /> Exportar PDF
            </Link>
          </div>
        </div>
      </section>

      {/* Alertas: solo si existen */}
      {d.alerts.length > 0 && (
        <ul className="space-y-2" aria-label="Alertas">
          {d.alerts.map((a, i) => (
            <li key={i}>
              <Link
                href={a.href ?? "#"}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ring-1 transition",
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

      {/* Partidos y registros */}
      <Card className="p-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <Figure label="Programados" value={t.scheduled} href="/partidos?estado=PROGRAMADO" dot="bg-sky-500" />
          <Figure label="Pendientes de resultado" value={t.pendingResult} href="/resultados" dot="bg-brand-600" tone={t.pendingResult ? "alert" : undefined} />
          <Figure label="Disputados" value={t.played} href="/partidos?estado=JUGADO" dot="bg-emerald-500" />
          <Figure label="Cancelados" value={t.cancelled} href="/partidos?estado=CANCELADO" dot="bg-zinc-400" />
          <Figure label="Reprogramados" value={t.rescheduled} href="/partidos?estado=REPROGRAMADO" dot="bg-violet-500" />
        </div>
        <div className="mx-3 border-t border-zinc-100" />
        <div className="grid grid-cols-2 sm:grid-cols-3">
          <Figure
            label="Equipos"
            value={
              <>
                {t.teams}
                <span className="block text-xs font-semibold text-zinc-500">
                  {d.leagues.map((l) => `${l.league.name}: ${l.activeTeams} activos`).join(" · ")}
                </span>
              </>
            }
            href="/equipos"
          />
          <Figure label="Árbitros activos" value={t.activeReferees} href="/arbitros" />
          <Figure label="Sanciones activas" value={t.activeSanctions} href="/sanciones" />
        </div>
      </Card>

      {/* Tabla y goleo por liga */}
      <div className="grid gap-5 xl:grid-cols-2">
        {d.leagues.map(({ league, standings, scorers }) => (
          <Card key={league.id}>
            <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
              <h2 className="font-display text-lg text-zinc-900">{league.name}</h2>
              <Link href={`/tabla?liga=${league.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
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
                <Link href={`/goleo?liga=${league.id}`} className="text-xs font-semibold text-brand-700 hover:underline">
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
                      <span className="font-extrabold text-brand-700 tabular-nums">{s.goals}</span>
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
