import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { createSeasonAction, setCurrentSeasonAction, setSeasonStatusAction } from "@/server/actions/config";
import { SeasonCreateButton } from "@/components/forms/config-forms";
import { SimpleToggleForm } from "@/components/forms/entity-forms";
import { ConfigContext } from "@/components/config/ConfigContext";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/core";
import { formatShort } from "@/lib/dates";
import { SEASON_STATUS } from "@/lib/labels";

export const metadata = { title: "Temporadas" };

export default async function TemporadasPage() {
  await requireUser();
  const seasons = await prisma.season.findMany({ orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }, { id: "asc" }], include: { _count: { select: { leagues: true, teams: true, matches: true } }, leagues: { select: { id: true, name: true, championTeam: { select: { name: true } } } } } });
  return <>
    <ConfigContext context="Administración de temporadas" title="Cada torneo conserva su historia" description="Usa el selector superior para consultar una temporada. Marcarla como vigente define cuál se abre por defecto cuando no hay otra seleccionada." />
    <Card className="overflow-hidden">
      <CardHeader title="Temporadas registradas" description="Consulta sus participantes, estado y campeones, o prepara una nueva temporada."
        actions={<SeasonCreateButton action={createSeasonAction} seasons={seasons.map((season) => ({ value: season.id, label: season.name }))} />} />
      {seasons.length ? <ul className="divide-y divide-slate-200 border-t border-slate-200">{seasons.map((season) => <li key={season.id} className={`p-5 ${season.isCurrent ? "border-l-4 border-orange-400 bg-blue-50/40" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h3 className="text-base font-bold break-words text-[#102d50]">{season.name}</h3><p className="mt-1 text-xs text-slate-600">Primera fecha: {formatShort(season.startDate)}</p><div className="mt-3 flex flex-wrap gap-2"><Badge className="bg-blue-50 text-blue-900 ring-blue-200">{SEASON_STATUS[season.status]}</Badge>{season.isCurrent && <Badge className="bg-emerald-50 text-emerald-900 ring-emerald-300">Vigente</Badge>}{season.isDemo && <Badge className="bg-amber-50 text-amber-900 ring-amber-300">Demo</Badge>}</div></div>
          <div className="flex flex-wrap gap-2">{!season.isCurrent && <SimpleToggleForm action={setCurrentSeasonAction} hidden={{ id: season.id }} label="Marcar vigente" />}{season.status !== "FINALIZADA" ? <SimpleToggleForm action={setSeasonStatusAction} hidden={{ id: season.id, status: "FINALIZADA" }} label="Finalizar temporada" variant="danger" /> : <SimpleToggleForm action={setSeasonStatusAction} hidden={{ id: season.id, status: "EN_CURSO" }} label="Reabrir temporada" />}</div>
        </div>
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">{[["Ligas", season._count.leagues], ["Equipos", season._count.teams], ["Partidos", season._count.matches]].map(([label, value]) => <div key={label} className="flex gap-2"><dt>{label}</dt><dd className="font-bold text-[#102d50] tabular-nums">{value}</dd></div>)}</dl>
        {season.leagues.some((league) => league.championTeam) && <div className="mt-4 border-t border-slate-200 pt-3"><h4 className="text-xs font-bold text-[#102d50]">Campeones</h4><ul className="mt-2 space-y-1 text-sm text-slate-600">{season.leagues.filter((league) => league.championTeam).map((league) => <li key={league.id} className="break-words">{league.name}: <strong>{league.championTeam!.name}</strong></li>)}</ul></div>}
      </li>)}</ul> : <EmptyState title="Prepara la primera temporada" description="Usa Nueva temporada para crear el calendario base y organizar a los participantes." />}
    </Card>
  </>;
}
