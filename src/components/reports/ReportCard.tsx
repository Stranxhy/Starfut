"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, FileText } from "lucide-react";
import type { ReportDefinition } from "@/domain/reports-view";
import { buttonClass, Card } from "@/components/ui/core";
import { SANCTION_STATUS } from "@/lib/labels";

type Option = { value: string; label: string };
export type ReportTeam = Option & { leagueId: string };

function ReportSelect({ name, label, options, required = false, value, onChange }: { name: string; label: string; options: Option[]; required?: boolean; value?: string; onChange?: (value: string) => void }) {
  return <label className="block min-w-0 text-xs font-semibold text-slate-700">{label}
    <select name={name} required={required} value={value} defaultValue={value === undefined ? "" : undefined} onChange={onChange ? (event) => onChange(event.target.value) : undefined} className="filter-control mt-2 block">
      <option value="">{required ? "Selecciona una opción" : name === "league" ? "Todas las ligas" : "Todos"}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}

export function ReportCard({ report, seasonId, leagues, teams, types }: { report: ReportDefinition; seasonId: string; leagues: Option[]; teams: ReportTeam[]; types: Option[] }) {
  const [league, setLeague] = useState("");
  const [team, setTeam] = useState("");
  const needsLeague = report.fields === "league-required";
  const needsTeam = report.fields === "team-required";
  const unavailable = needsLeague && !leagues.length ? "league" : needsTeam && !teams.length ? "team" : null;
  const teamOptions = report.fields === "history" && league ? teams.filter((option) => option.leagueId === league) : teams;
  return <Card className="min-w-0 overflow-hidden">
    <form action={`/api/pdf/${report.doc}`} method="get" target="_blank" aria-label={`Generar ${report.title}`} className="flex h-full flex-col">
      <input type="hidden" name="season" value={seasonId} />
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><FileText className="mb-3 h-5 w-5 text-blue-800" aria-hidden /><h3 className="text-base font-bold break-words text-[#102d50]">{report.title}</h3><p className="mt-2 text-xs leading-relaxed text-slate-600">{report.description}</p></div>
      <div className="grid flex-1 content-start gap-4 p-5">
        {!needsTeam && <ReportSelect name="league" label="Liga" options={leagues} required={needsLeague} value={league} onChange={(value) => { setLeague(value); setTeam(""); }} />}
        {(report.fields === "history" || needsTeam) && <ReportSelect name="team" label="Equipo" options={teamOptions} required={needsTeam} value={team} onChange={setTeam} />}
        {report.fields === "sanctions" && <>
          <ReportSelect name="status" label="Estado de la sanción" options={Object.entries(SANCTION_STATUS).map(([value, info]) => ({ value, label: info.label }))} />
          <ReportSelect name="type" label="Tipo de sanción" options={types} />
          <Link href="/sanciones" className="rounded text-xs font-semibold text-blue-800 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-blue-700">Filtrar también por jugador y fechas</Link>
        </>}
      </div>
      <div className="border-t border-slate-200 px-5 py-4">
        {unavailable ? <p className="text-sm text-slate-600">{unavailable === "league" ? "Crea una liga para generar este documento." : "Registra un equipo para generar sus estadísticas."} <Link href={unavailable === "league" ? "/ligas" : "/equipos"} className="rounded font-semibold text-blue-800 underline focus-visible:outline-2 focus-visible:outline-blue-700">{unavailable === "league" ? "Ir a Ligas" : "Ir a Equipos"}</Link></p> : <div className="flex flex-wrap gap-2">
          <button type="submit" name="download" value="0" className={buttonClass("primary", "sm")}>Abrir PDF</button>
          <button type="submit" name="download" value="1" className={buttonClass("secondary", "sm")}><Download className="h-4 w-4" aria-hidden />Descargar</button>
        </div>}
      </div>
    </form>
  </Card>;
}
