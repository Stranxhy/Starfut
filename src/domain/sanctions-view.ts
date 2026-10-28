import type { Prisma } from "@prisma/client";
import { normalizeName } from "./text";
import { sanctionProgress, type SanctionStatusCode, type SanctionUnitKindCode } from "./sanctions";

const STATUSES: SanctionStatusCode[] = ["ACTIVA", "PENDIENTE", "CUMPLIDA", "CANCELADA", "EN_REVISION"];

export function validSanctionDate(value?: string): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function resolveSanctionsView(query: Record<string, string | undefined>, leagueIds: string[], teams: { id: string; leagueId: string }[], typeIds: string[]) {
  const liga = query.liga && leagueIds.includes(query.liga) ? query.liga : "";
  const equipo = teams.find((team) => team.id === query.equipo && (!liga || team.leagueId === liga))?.id ?? "";
  const desde = validSanctionDate(query.desde) ? query.desde! : "";
  const hasta = validSanctionDate(query.hasta) ? query.hasta! : "";
  const dateError = (query.desde && !desde) || (query.hasta && !hasta)
    ? "Revisa las fechas: indica un día válido en Desde y Hasta."
    : desde && hasta && desde > hasta ? "La fecha Desde debe ser anterior o igual a Hasta." : undefined;
  const requestedPage = Number(query.page);
  return {
    q: query.q?.trim() ?? "", liga, equipo,
    tipo: query.tipo && typeIds.includes(query.tipo) ? query.tipo : "",
    estado: STATUSES.includes(query.estado as SanctionStatusCode) ? query.estado as SanctionStatusCode : "" as const,
    desde, hasta, dateError,
    requestedPage: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  };
}

export type SanctionsView = ReturnType<typeof resolveSanctionsView>;

export function sanctionsWhere(seasonId: string, view: SanctionsView): Prisma.SanctionWhereInput {
  return {
    seasonId,
    ...(view.equipo ? { teamId: view.equipo } : {}),
    ...(view.liga ? { team: { leagueId: view.liga } } : {}),
    ...(view.tipo ? { typeId: view.tipo } : {}),
    ...(view.estado ? { status: view.estado } : {}),
    ...(view.q ? { player: { nameKey: { contains: normalizeName(view.q) } } } : {}),
    // Un periodo inválido no debe mostrar resultados de un periodo más amplio.
    ...(view.dateError ? { id: { in: [] } } : view.desde || view.hasta ? { date: {
      ...(view.desde ? { gte: new Date(`${view.desde}T00:00:00Z`) } : {}),
      ...(view.hasta ? { lte: new Date(`${view.hasta}T00:00:00Z`) } : {}),
    } } : {}),
  };
}

export function sanctionsPdfHref(seasonId: string, view: SanctionsView) {
  if (view.dateError) return null;
  const params = new URLSearchParams({ season: seasonId });
  for (const [key, value] of Object.entries({ q: view.q, league: view.liga, team: view.equipo, type: view.tipo, status: view.estado, from: view.desde, to: view.hasta })) {
    if (value) params.set(key, value);
  }
  return `/api/pdf/sanciones?${params}`;
}

/** El avance registrado no sustituye el estado administrativo de la sanción. */
export function sanctionFollowUp(kind: SanctionUnitKindCode, duration: number, served: number, status: SanctionStatusCode) {
  const progress = sanctionProgress(kind, duration, served);
  const canRegister = status !== "CANCELADA" && !(kind === "PARTIDOS" && progress.complete);
  const guidance = status === "CANCELADA" ? "La sanción está cancelada. Su historial se conserva para consulta."
    : kind !== "PARTIDOS" ? "Registra el cumplimiento y actualiza el estado en Editar sanción. Esta unidad no se convierte a partidos."
    : status === "EN_REVISION" ? "El registro de partidos no cambia el estado En revisión. Revisa el caso antes de actualizarlo en Editar sanción."
    : progress.complete ? status === "CUMPLIDA" ? "Todos los partidos están registrados y la sanción figura como cumplida." : "Todos los partidos están registrados. Revisa el estado en Editar sanción."
    : "Al registrar todos los partidos, el estado se actualiza a Cumplida. Puedes registrar un partido o una fecha de cumplimiento.";
  return { ...progress, canRegister, guidance, percent: kind === "PARTIDOS" && duration > 0 ? Math.min(100, served / duration * 100) : null };
}
