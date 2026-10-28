import Link from "next/link";
import { Badge } from "@/components/ui/core";
import { JerseyNumber, PlayerStatus } from "./PlayerIdentity";

type DirectoryPlayer = {
  id: string; fullName: string; jerseyNumber: number | null; active: boolean; isDemo: boolean;
  team: { id: string; name: string; active: boolean; league: { name: string } };
};

function CurrentTeam({ team }: { team: DirectoryPlayer["team"] }) {
  return <div className="min-w-0"><Link href={`/equipos/${team.id}`} className="rounded break-words text-slate-700 hover:text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">{team.name}</Link><p className="mt-1 text-xs break-words text-slate-500">{team.league.name}{!team.active && " · Equipo dado de baja"}</p></div>;
}

export function PlayersDirectory({ players, goals }: { players: DirectoryPlayer[]; goals: Map<string, number> }) {
  return <table className="w-full table-fixed border-collapse text-sm">
    <caption className="sr-only">Jugadores y su equipo actual. Goles de competencia acumulados en la temporada, incluidos equipos anteriores y eliminatorias; excluye amistosos.</caption>
    <thead><tr className="border-b border-slate-300 bg-slate-100 text-left text-xs font-bold text-slate-600">
      <th scope="col" className="px-4 py-4 sm:px-5">Jugador</th><th scope="col" className="hidden w-[30%] px-4 py-4 md:table-cell">Equipo actual / liga</th><th scope="col" className="w-20 px-2 py-4 text-center">Goles</th><th scope="col" className="hidden w-28 px-4 py-4 text-center sm:table-cell">Estado</th>
    </tr></thead>
    <tbody>{players.map((player, index) => <tr key={player.id} className={`border-b border-slate-200 last:border-0 hover:bg-blue-50/60 ${index % 2 ? "bg-slate-50" : "bg-white"}`}>
      <th scope="row" className="px-4 py-4 text-left font-normal sm:px-5"><div className="flex items-start gap-2 sm:gap-3"><span className="hidden sm:block"><JerseyNumber number={player.jerseyNumber} /></span><div className="min-w-0">
        <p className="mb-1 text-xs text-slate-500 sm:hidden">{player.jerseyNumber === null ? "Sin camiseta asignada" : `Camiseta ${player.jerseyNumber}`}</p>
        <Link href={`/jugadores/${player.id}`} className="rounded font-bold break-words text-[#102d50] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">{player.fullName}</Link>
        <div className="mt-2 text-xs md:hidden"><CurrentTeam team={player.team} /></div>
        <div className="mt-2 flex flex-wrap items-center gap-2"><Link href={`/jugadores/${player.id}`} aria-label={`Ver ficha de ${player.fullName}`} className="rounded text-xs font-semibold text-blue-800 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-blue-700">Ver ficha</Link><span className="sm:hidden"><PlayerStatus active={player.active} /></span>{player.isDemo && <Badge className="bg-amber-50 text-amber-900 ring-amber-300">Demo</Badge>}</div>
      </div></div></th>
      <td className="hidden px-4 py-4 md:table-cell"><CurrentTeam team={player.team} /></td>
      <td className="px-2 py-4 text-center"><Link href={`/jugadores/${player.id}#goles-jugador`} aria-label={`Ver goles de ${player.fullName}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-lg font-bold text-[#102d50] tabular-nums hover:border-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">{goals.get(player.id) ?? 0}</Link></td>
      <td className="hidden px-4 py-4 text-center sm:table-cell"><PlayerStatus active={player.active} /></td>
    </tr>)}</tbody>
  </table>;
}
