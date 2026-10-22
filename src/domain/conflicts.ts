// Detección de conflictos al crear o modificar un partido manualmente.
// errors   → restricciones obligatorias: impiden guardar.
// warnings → situaciones que el administrador debe confirmar conscientemente.

import {
  isFieldBlocked,
  isRefereeAvailable,
  teamRestriction,
  type FieldBlockInput,
  type RefereeAvailabilityInput,
  type TeamRestrictionInput,
} from "./availability";

export type MatchTypeCode = "OFICIAL" | "SUSTITUCION" | "AMISTOSO" | "INTERLIGA" | "ELIMINATORIA";

export interface MatchCandidate {
  id?: string;
  date: string | null;
  timeSlotId: string | null;
  fieldId: string | null;
  refereeId: string | null;
  homeTeamId: string;
  awayTeamId: string;
  type: MatchTypeCode;
}

export interface ExistingMatch {
  id: string;
  date: string | null;
  timeSlotId: string | null;
  fieldId: string | null;
  refereeId: string | null;
  homeTeamId: string;
  awayTeamId: string;
}

export interface ConflictContext {
  /** Partidos no cancelados de la misma fecha (puede incluir al propio partido; se excluye por id). */
  sameDateMatches: ExistingMatch[];
  fieldBlocks: FieldBlockInput[];
  teamRestrictions: TeamRestrictionInput[];
  refereeAvailability: RefereeAvailabilityInput[];
  teams: Map<string, { name: string; leagueId: string; active: boolean }>;
  referees: Map<string, { name: string; active: boolean }>;
  fields: Map<string, { name: string; active: boolean }>;
  timeSlots: Map<string, { startTime: string; active: boolean }>;
  allowInterLeague: boolean;
  requireReferee: boolean;
  /** Veces que ya se han enfrentado estos equipos en partidos oficiales de la fase regular. */
  previousMeetings: number;
}

export function checkMatchConflicts(c: MatchCandidate, ctx: ConflictContext): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const home = ctx.teams.get(c.homeTeamId);
  const away = ctx.teams.get(c.awayTeamId);
  const tName = (id: string) => ctx.teams.get(id)?.name ?? "Equipo desconocido";

  if (!home || !away) errors.push("Selecciona dos equipos válidos.");
  if (c.homeTeamId === c.awayTeamId) errors.push("Un equipo no puede enfrentarse a sí mismo.");
  if (home && !home.active) errors.push(`${home.name} está inactivo.`);
  if (away && !away.active) errors.push(`${away.name} está inactivo.`);

  if (home && away && home.leagueId !== away.leagueId) {
    if (c.type === "AMISTOSO") {
      warnings.push("Partido amistoso entre equipos de ligas diferentes: no altera la clasificación.");
    } else if (c.type !== "INTERLIGA") {
      errors.push(
        "Los equipos pertenecen a ligas diferentes. Para autorizarlo, marca el partido como \"Extraordinario entre ligas\" o \"Amistoso\".",
      );
    } else if (!ctx.allowInterLeague) {
      warnings.push(
        "Los enfrentamientos entre ligas están desactivados en la configuración; este partido se autoriza de forma excepcional.",
      );
    }
  }

  if (c.date && c.timeSlotId) {
    const ts = ctx.timeSlots.get(c.timeSlotId);
    const at = ts ? ` a las ${ts.startTime}` : "";
    if (ts && !ts.active) warnings.push(`El horario ${ts.startTime} está desactivado.`);
    const others = ctx.sameDateMatches.filter((m) => m.id !== c.id && m.date === c.date);
    const simultaneous = others.filter((m) => m.timeSlotId === c.timeSlotId);

    if (c.fieldId) {
      const f = ctx.fields.get(c.fieldId);
      if (f && !f.active) errors.push(`${f.name} está desactivada.`);
      if (simultaneous.some((m) => m.fieldId === c.fieldId)) {
        errors.push(`${f?.name ?? "La cancha"} ya está ocupada el ${c.date}${at}.`);
      }
      if (isFieldBlocked(ctx.fieldBlocks, c.fieldId, c.date, c.timeSlotId)) {
        errors.push(`${f?.name ?? "La cancha"} no está disponible el ${c.date}${at}.`);
      }
    }
    for (const t of [c.homeTeamId, c.awayTeamId]) {
      if (simultaneous.some((m) => m.homeTeamId === t || m.awayTeamId === t)) {
        errors.push(`${tName(t)} ya tiene un partido a la misma hora (${c.date}${at}).`);
      } else if (others.some((m) => m.homeTeamId === t || m.awayTeamId === t)) {
        warnings.push(`${tName(t)} ya juega otro partido el mismo día.`);
      }
      const r = teamRestriction(ctx.teamRestrictions, t, c.date, c.timeSlotId);
      if (r) warnings.push(`${tName(t)} tiene una restricción de disponibilidad${r.reason ? `: ${r.reason}` : ""}.`);
    }
    if (c.refereeId) {
      const ref = ctx.referees.get(c.refereeId);
      if (ref && !ref.active) errors.push(`El árbitro ${ref.name} está inactivo.`);
      if (simultaneous.some((m) => m.refereeId === c.refereeId)) {
        errors.push(`El árbitro ${ref?.name ?? ""} ya tiene otro partido a la misma hora.`);
      }
      if (!isRefereeAvailable(ctx.refereeAvailability, c.refereeId, c.date, c.timeSlotId)) {
        errors.push(`El árbitro ${ref?.name ?? ""} registró que no está disponible el ${c.date}${at}.`);
      }
    }
  }

  if (c.date && c.timeSlotId && !c.fieldId) warnings.push("El partido no tiene cancha asignada.");
  if (c.date && c.timeSlotId && !c.refereeId && ctx.requireReferee) {
    warnings.push("El partido no tiene árbitro asignado y la configuración lo exige.");
  }
  if (ctx.previousMeetings > 0 && (c.type === "OFICIAL" || c.type === "SUSTITUCION")) {
    warnings.push(`Estos equipos ya se enfrentaron ${ctx.previousMeetings} vez/veces en la fase regular.`);
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
