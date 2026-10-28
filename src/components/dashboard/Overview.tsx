import Link from "next/link";
import {
  CalendarDays, CheckCheck, ChevronRight, ClipboardList, Clock3,
  FileDown, RotateCcw, Shield, ShieldAlert, XCircle, type LucideIcon,
} from "lucide-react";
import { cn } from "@/components/ui/core";
import { getDashboardAction, type DashboardProgress } from "@/domain/dashboard";
import { formatLong } from "@/lib/dates";

type Metric = {
  label: string;
  value: number;
  hint: string;
  href: string;
  action: string;
  icon: LucideIcon;
  color: string;
  attention?: boolean;
};

function MetricLink({ label, value, hint, href, action, icon: Icon, color, attention }: Metric) {
  return (
    <Link href={href} className={cn(
      "group flex min-w-0 flex-col rounded-xl border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700",
      attention ? "border-orange-600 bg-orange-50 hover:bg-orange-100" : "border-slate-400 bg-white hover:border-blue-700 hover:bg-blue-50/50",
    )}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Icon className={cn("h-5 w-5", color)} aria-hidden />
        {attention && <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-900">Por atender</span>}
      </div>
      <p className="text-sm font-semibold leading-5 text-slate-700">{label}</p>
      <p className="mt-1 text-4xl font-bold tracking-tight text-slate-950 tabular-nums">{value.toLocaleString("es-MX")}</p>
      <p className="mt-2 mb-4 text-xs leading-5 text-slate-600">{hint}</p>
      <span className="mt-auto flex items-center justify-between gap-2 border-t border-slate-300/70 pt-3 text-xs font-semibold text-blue-900">
        {action}<ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
      </span>
    </Link>
  );
}

interface OverviewProps {
  seasonName: string;
  progress: DashboardProgress;
  totals: { scheduled: number; pendingResult: number; played: number; cancelled: number; rescheduled: number; teams: number; activeSanctions: number };
  teamsByLeague: string;
}

export function DashboardOverview({ seasonName, progress, totals, teamsByLeague }: OverviewProps) {
  const next = getDashboardAction(progress);
  const setup = !progress.hasMatches && !progress.hasDraft;
  const steps = [
    { label: "Equipos", done: progress.activeTeams >= 2 },
    { label: "Calendario", done: false },
    { label: "Resultados", done: false },
  ];
  const metrics: Metric[] = [
    { label: "Pendientes de resultado", value: totals.pendingResult, hint: "De fechas anteriores", href: progress.pendingResultDate ? `/resultados?date=${progress.pendingResultDate}` : "/resultados", action: "Ver resultados", icon: ClipboardList, color: "text-orange-700", attention: totals.pendingResult > 0 },
    { label: "Programados", value: totals.scheduled, hint: "Hoy y próximas fechas; incluye reprogramados", href: "/calendario", action: "Ver calendario", icon: CalendarDays, color: "text-blue-700" },
    { label: "Disputados", value: totals.played, hint: "Con resultado registrado", href: "/partidos?estado=JUGADO", action: "Ver partidos", icon: CheckCheck, color: "text-emerald-700" },
    { label: "Reprogramados", value: totals.rescheduled, hint: "Con cambio de programación", href: "/partidos?estado=REPROGRAMADO", action: "Ver cambios", icon: RotateCcw, color: "text-blue-700" },
    { label: "Cancelados", value: totals.cancelled, hint: "En esta temporada", href: "/partidos?estado=CANCELADO", action: "Ver cancelados", icon: XCircle, color: "text-slate-600" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Inicio</h1>
          <p className="mt-1 text-sm text-slate-600">Tu temporada, de un vistazo.</p>
        </div>
        <span className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">{seasonName}</span>
      </div>

      <section aria-labelledby="next-action-title" className="overflow-hidden rounded-2xl border border-[#163d68] bg-[#102d50] text-white">
        <div className="grid gap-6 border-l-4 border-[#ff981f] p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div>
            {progress.nextDate && (
              <p className="mb-3 flex items-start gap-2 text-sm font-medium text-blue-100">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {progress.nextDate === progress.today ? "Hoy" : "Próxima fecha"}: {formatLong(progress.nextDate)}
              </p>
            )}
            <h2 id="next-action-title" className="max-w-2xl text-2xl leading-tight font-bold tracking-tight sm:text-3xl">{next.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">{next.description}</p>
          </div>
          <div className="flex flex-wrap gap-3 xl:max-w-60 xl:flex-col">
            <Link href={next.href} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#ff981f] px-4 py-3 text-sm font-bold text-[#102d50] transition-colors hover:bg-[#ffb451] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              {next.label}<ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
            {progress.hasMatches && (
              <Link href="/reportes" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-200/60 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                <FileDown className="h-4 w-4 shrink-0" aria-hidden />PDF para WhatsApp
              </Link>
            )}
          </div>
        </div>
        {setup && progress.activeLeagues > 0 && (
          <ol aria-label="Preparación de la temporada" className="grid gap-4 border-t border-white/20 bg-white/5 px-6 py-4 sm:grid-cols-3 sm:px-8">
            {steps.map((step, i) => (
              <li key={step.label} className="flex items-center gap-3 text-sm">
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold", step.done ? "border-blue-200 bg-blue-100 text-blue-950" : "border-white/50 text-white")} aria-hidden>
                  {step.done ? <CheckCheck className="h-4 w-4" /> : i + 1}
                </span>
                <span>{step.label}<span className="mt-0.5 block text-xs text-blue-100">{step.done ? "Equipos registrados" : i === 0 || (i === 1 && progress.activeTeams >= 2) ? "Siguiente paso" : "Después"}</span></span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="match-summary-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="match-summary-title" className="text-lg font-bold text-slate-950">Partidos de la temporada</h2>
            <p className="mt-1 text-sm text-slate-600">Abre cada indicador para consultar el detalle.</p>
          </div>
          <Link href="/partidos" className="rounded text-sm font-semibold text-blue-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">Ver todos los partidos</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 sm:[&>a:last-child]:col-span-2 xl:grid-cols-5 xl:[&>a:last-child]:col-span-1">
          {metrics.map((metric) => <MetricLink key={metric.label} {...metric} />)}
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <Link href="/equipos" className="flex min-w-0 items-center gap-4 rounded-xl border border-slate-300 bg-white p-4 transition-colors hover:border-blue-700 hover:bg-blue-50/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">
          <Shield className="h-6 w-6 shrink-0 text-blue-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-700">Equipos registrados</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{teamsByLeague || "Registra los participantes de tus ligas."}</p>
          </div>
          <span className="text-2xl font-bold text-slate-950 tabular-nums">{totals.teams.toLocaleString("es-MX")}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        </Link>
        <Link href="/sanciones" className="flex min-w-0 items-center gap-4 rounded-xl border border-slate-300 bg-white p-4 transition-colors hover:border-blue-700 hover:bg-blue-50/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">
          <ShieldAlert className="h-6 w-6 shrink-0 text-blue-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-700">Sanciones por atender</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Activas, pendientes o en revisión.</p>
          </div>
          <span className="text-2xl font-bold text-slate-950 tabular-nums">{totals.activeSanctions.toLocaleString("es-MX")}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        </Link>
      </div>
    </>
  );
}
