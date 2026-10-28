import Link from "next/link";
import { Badge } from "@/components/ui/core";
import { TeamCrest, TeamStatus } from "./TeamIdentity";

type DirectoryTeam = {
  id: string; name: string; active: boolean; isDemo: boolean; logoMime: string | null;
  league: { id: string; name: string };
  _count: { players: number };
};

export function TeamsDirectory({ teams }: { teams: DirectoryTeam[] }) {
  return <table className="w-full table-fixed border-collapse text-sm">
    <caption className="sr-only">Equipos de la temporada. La plantilla cuenta solo jugadores activos. Abre el nombre de un equipo para ver su ficha.</caption>
    <thead><tr className="border-b border-slate-300 bg-slate-100 text-left text-xs font-bold text-slate-600">
      <th scope="col" className="px-4 py-4 sm:px-5">Equipo</th>
      <th scope="col" className="hidden w-[25%] px-4 py-4 md:table-cell">Liga</th>
      <th scope="col" className="w-24 px-2 py-4 text-center sm:w-32">Jugadores activos</th>
      <th scope="col" className="hidden w-28 px-4 py-4 text-center sm:table-cell">Estado</th>
    </tr></thead>
    <tbody>{teams.map((team, index) => <tr key={team.id} className={`border-b border-slate-200 last:border-0 hover:bg-blue-50/60 ${index % 2 ? "bg-slate-50" : "bg-white"}`}>
      <th scope="row" className="px-4 py-4 text-left font-normal sm:px-5">
        <div className="flex items-start gap-3"><span className="hidden sm:block"><TeamCrest id={team.id} hasLogo={!!team.logoMime} /></span><div className="min-w-0">
          <Link href={`/equipos/${team.id}`} className="rounded font-bold break-words text-[#102d50] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">{team.name}</Link>
          <p className="mt-1 text-xs break-words text-slate-600 md:hidden">{team.league.name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2"><Link href={`/equipos/${team.id}`} aria-label={`Ver ficha de ${team.name}`} className="rounded text-xs font-semibold text-blue-800 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-blue-700">Ver ficha</Link><span className="sm:hidden"><TeamStatus active={team.active} /></span>{team.isDemo && <Badge className="bg-amber-50 text-amber-900 ring-amber-300">Demo</Badge>}</div>
        </div></div>
      </th>
      <td className="hidden px-4 py-4 md:table-cell"><Link href={`/ligas/${team.league.id}`} className="rounded break-words text-slate-700 hover:text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">{team.league.name}</Link></td>
      <td className="px-2 py-4 text-center"><Link href={`/equipos/${team.id}#plantilla`} aria-label={`Consultar plantilla de ${team.name}: ${team._count.players} jugadores activos`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-lg font-bold text-[#102d50] tabular-nums hover:border-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">{team._count.players}</Link></td>
      <td className="hidden px-4 py-4 text-center sm:table-cell"><TeamStatus active={team.active} /></td>
    </tr>)}</tbody>
  </table>;
}
