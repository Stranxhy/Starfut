import { CalendarDays, Clock3, MapPin } from "lucide-react";
import type { MatchWithRelations } from "@/server/services/matches";
import { Badge, LinkButton } from "@/components/ui/core";
import { StatusBadge, TypeBadge } from "@/components/match-ui";
import { MatchScoreboard } from "./MatchScoreboard";
import { captureState, groupMatchesByDate } from "@/domain/match-presentation";
import { formatLong } from "@/lib/dates";

export function MatchMeta({ match: m }: { match: MatchWithRelations }) {
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-600">
    <span className="inline-flex items-center gap-1.5 font-bold text-[#102d50] tabular-nums"><Clock3 className="h-3.5 w-3.5" aria-hidden />{m.timeSlot?.startTime ?? "Sin horario"}</span>
    <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />{m.field?.name ?? "Sin cancha"}</span>
    <span>{m.league?.name ?? "Interliga"}</span>
    {m.round?.phase === "REGULAR" && <span>Jornada {m.round.number}</span>}
    {m.stage !== "REGULAR" && <span>{m.stage.replaceAll("_", " ").toLocaleLowerCase("es-MX")}</span>}
    <StatusBadge status={m.status} /><TypeBadge type={m.type} counts={m.countsForStandings} />
    {(m.locked || m.round?.locked) && m.status !== "JUGADO" && <Badge className="bg-sky-50 text-sky-800 ring-sky-200">Protegido</Badge>}
  </div>;
}

export function MatchList({ matches }: { matches: MatchWithRelations[] }) {
  return <div className="space-y-6 p-4 sm:p-5">
    {groupMatchesByDate(matches).map(([date, items]) => <section key={date ?? "sin-fecha"} aria-label={date ? formatLong(date) : "Por programar"}>
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <CalendarDays className="h-4 w-4 text-blue-800" aria-hidden />
        <h2 className="text-sm font-bold text-[#102d50] capitalize">{date ? formatLong(date) : "Por programar"}</h2>
        <span className="ml-auto text-xs text-slate-500">{items.length} {items.length === 1 ? "partido" : "partidos"}</span>
      </div>
      <ul className="space-y-3">
        {items.map((m) => {
          const state = captureState(m);
          const results = state === "pendientes" || state === "registrados";
          const label = state === "pendientes" ? "Capturar resultado" : state === "registrados" ? "Ver resultado" : state === "programar" ? "Programar partido" : "Ver partido";
          return <li key={m.id} className={`rounded-xl border p-4 sm:p-5 ${state === "cancelados" ? "border-slate-200 bg-slate-50" : "border-slate-300 bg-white"}`}>
            <MatchMeta match={m} />
            <div className="mt-4 grid items-center gap-5 2xl:grid-cols-[minmax(0,1fr)_auto]">
              <MatchScoreboard homeTeam={m.homeTeam} awayTeam={m.awayTeam} result={m.result} />
              <div className="flex flex-wrap justify-end gap-2">
                {results && <LinkButton href={`/partidos/${m.id}`} variant="secondary" size="sm">Ver partido</LinkButton>}
                <LinkButton href={`/${results ? "resultados" : "partidos"}/${m.id}`} variant={state === "pendientes" || state === "programar" ? "primary" : "secondary"} size="sm">{label}</LinkButton>
              </div>
            </div>
          </li>;
        })}
      </ul>
    </section>)}
  </div>;
}
