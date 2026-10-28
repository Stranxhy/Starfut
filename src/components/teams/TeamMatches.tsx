import Link from "next/link";
import type { MatchWithRelations } from "@/server/services/matches";
import { formatShort } from "@/lib/dates";
import { StatusBadge, TypeBadge } from "@/components/match-ui";
import { MatchScoreboard } from "@/components/matches/MatchScoreboard";

export function TeamMatches({ matches, label }: { matches: MatchWithRelations[]; label: string }) {
  return <div role="region" aria-label={label} tabIndex={0} className="max-h-[36rem] overflow-y-auto rounded-b-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700">
    <ul className="divide-y divide-slate-200">{matches.map((match) => <li key={match.id} className="px-4 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/partidos/${match.id}`} className="rounded text-xs font-bold text-blue-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">{match.date ? formatShort(match.date) : "Por programar"} · {match.timeSlot?.startTime ?? "Sin horario"}</Link>
        <div className="flex flex-wrap gap-2"><StatusBadge status={match.status} /><TypeBadge type={match.type} counts={match.countsForStandings} /></div>
      </div>
      <MatchScoreboard homeTeam={match.homeTeam} awayTeam={match.awayTeam} result={match.result} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="min-w-0 break-words text-slate-600">{match.field?.name ?? "Sin cancha"}{match.round?.phase === "REGULAR" ? ` · Jornada ${match.round.number}` : ""}</p>
        <Link href={`/partidos/${match.id}`} className="rounded font-semibold text-blue-800 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-blue-700">Ver partido</Link>
      </div>
    </li>)}</ul>
  </div>;
}
