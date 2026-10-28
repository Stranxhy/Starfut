import Link from "next/link";
import type { ScorerRow } from "@/domain/scorers";

function ScoringTeams({ teams }: { teams: ScorerRow["teams"] }) {
  return <ul className="space-y-1.5 text-xs leading-relaxed text-slate-600 sm:text-sm">
    {teams.map((team) => <li key={team.teamId}>
      <Link href={`/equipos/${team.teamId}`} className="rounded break-words text-slate-700 hover:text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">{team.teamName}</Link>
      {teams.length > 1 && <span className="ml-1 font-semibold whitespace-nowrap text-[#102d50]">· {team.goals} {team.goals === 1 ? "gol" : "goles"}</span>}
    </li>)}
  </ul>;
}

export function ScorersTable({ rows, caption }: { rows: ScorerRow[]; caption: string }) {
  return <table className="w-full table-fixed border-collapse text-sm">
    <caption className="sr-only">{caption}. Clasificación por goles individuales. Los empates no resueltos comparten posición.</caption>
    <thead>
      <tr className="border-b border-slate-300 bg-slate-100 text-xs font-bold text-slate-600">
        <th scope="col" className="px-3 py-4 text-left sm:px-4"><span className="mr-3">Pos.</span>Jugador</th>
        <th scope="col" className="w-20 bg-[#102d50] px-2 py-4 text-center text-white sm:w-24">Goles</th>
        <th scope="col" className="hidden w-[28%] px-4 py-4 text-left sm:table-cell">Equipo(s)</th>
        <th scope="col" className="hidden w-32 px-3 py-4 text-center md:table-cell">Partidos con gol</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row, index) => <tr key={row.playerId} className={`border-b border-slate-200 last:border-b-0 hover:bg-blue-50/60 ${index % 2 ? "bg-slate-50" : "bg-white"}`}>
        <th scope="row" className={`border-l-4 px-3 py-4 text-left font-normal sm:px-4 ${row.position === 1 ? "border-l-orange-400" : "border-l-transparent"}`}>
          <div className="flex items-start gap-2 sm:gap-3">
            <span className={`inline-grid h-8 min-w-8 shrink-0 place-items-center rounded-lg border px-1 text-sm font-bold tabular-nums ${row.position === 1 ? "border-orange-300 bg-orange-50 text-orange-950" : "border-slate-300 bg-white text-[#102d50]"}`}><span className="sr-only">Posición </span>{row.position}</span>
            <div className="min-w-0 pt-1">
              <Link href={`/jugadores/${row.playerId}`} className="rounded font-bold break-words text-[#102d50] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">{row.playerName}</Link>
              {row.shared && <p className="mt-1 text-[11px] font-semibold text-amber-800">Posición compartida</p>}
              <div className="mt-2 sm:hidden"><ScoringTeams teams={row.teams} /></div>
              {row.teams.length > 1 && <p className="mt-1 text-[11px] text-slate-500">Anotó con {row.teams.length} equipos</p>}
              <p className="mt-2 text-xs text-slate-600 md:hidden">{row.matchesWithGoal} {row.matchesWithGoal === 1 ? "partido con gol" : "partidos con gol"}</p>
            </div>
          </div>
        </th>
        <td className="bg-blue-50 px-2 py-4 text-center text-2xl font-extrabold text-[#102d50] tabular-nums">{row.goals}</td>
        <td className="hidden px-4 py-4 align-middle sm:table-cell"><ScoringTeams teams={row.teams} /></td>
        <td className="hidden px-3 py-4 text-center font-semibold text-slate-700 tabular-nums md:table-cell">{row.matchesWithGoal}</td>
      </tr>)}
    </tbody>
  </table>;
}
