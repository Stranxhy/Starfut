import { sanctionFollowUp } from "@/domain/sanctions-view";
import type { SanctionStatusCode, SanctionUnitKindCode } from "@/domain/sanctions";

export function SanctionProgress({ kind, duration, served, status }: { kind: SanctionUnitKindCode; duration: number; served: number; status: SanctionStatusCode }) {
  const progress = sanctionFollowUp(kind, duration, served, status);
  return <div className="space-y-2">
    <p className="text-sm font-semibold text-[#102d50] tabular-nums">{kind === "PARTIDOS" ? `${served} de ${duration} partidos registrados` : `${served} ${served === 1 ? "registro de cumplimiento" : "registros de cumplimiento"}`}</p>
    {progress.percent !== null && <div role="progressbar" aria-label="Partidos registrados como cumplimiento" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Math.min(served, duration)} aria-valuetext={`${served} de ${duration} partidos registrados`} className="h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full ${status === "CANCELADA" ? "bg-slate-400" : "bg-[#1b4776]"}`} style={{ width: `${progress.percent}%` }} /></div>}
    <p className="text-xs leading-relaxed text-slate-600">{status === "CANCELADA" ? "Cancelada; se conserva el historial." : kind === "PARTIDOS" ? progress.remaining === 0 ? "Partidos completos; consulta el estado de la sanción." : `${progress.remaining} ${progress.remaining === 1 ? "partido por registrar" : "partidos por registrar"}` : "Seguimiento y estado manuales."}</p>
  </div>;
}
