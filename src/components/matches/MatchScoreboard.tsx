import Link from "next/link";

type Team = { id: string; name: string; active?: boolean };
type Result = {
  homeGoals: number; awayGoals: number; resultType: string;
  homeShootout: number | null; awayShootout: number | null; winnerTeamId: string | null;
};

export function MatchScoreboard({ homeTeam, awayTeam, result }: { homeTeam: Team; awayTeam: Team; result: Result | null }) {
  const team = (t: Team, side: string) => (
    <div className="min-w-0 text-center">
      <p className="mb-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{side}</p>
      <Link href={`/equipos/${t.id}`} className={`rounded text-sm break-words text-[#102d50] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 sm:text-base ${result?.winnerTeamId === t.id ? "font-extrabold" : "font-semibold"}`}>{t.name}</Link>
      {t.active === false && <span className="mt-1 block text-xs font-medium text-amber-800">Equipo dado de baja</span>}
    </div>
  );
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-5">
        {team(homeTeam, "Local")}
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center sm:px-4">
          {result ? <p className="text-2xl font-extrabold whitespace-nowrap text-[#102d50] tabular-nums" aria-label={`Marcador: ${result.homeGoals} a ${result.awayGoals}`}>
            {result.homeGoals}<span className="mx-2 text-base font-medium text-slate-400">–</span>{result.awayGoals}
          </p> : <span className="text-xs font-bold tracking-wider text-slate-500">VS</span>}
        </div>
        {team(awayTeam, "Visitante")}
      </div>
      {result?.resultType === "DESEMPATE" && <p className="mt-3 text-center text-xs font-medium text-blue-800">
        {result.homeShootout != null && result.awayShootout != null
          ? `Penales: ${result.homeShootout} – ${result.awayShootout}`
          : `Gana ${result.winnerTeamId === homeTeam.id ? homeTeam.name : awayTeam.name} en desempate`}
      </p>}
      {result?.resultType === "ADMINISTRATIVO" && <p className="mt-3 text-center text-xs font-medium text-amber-800">Resultado por decisión administrativa</p>}
    </div>
  );
}
