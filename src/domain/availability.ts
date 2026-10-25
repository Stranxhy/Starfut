// Reglas de disponibilidad compartidas por el generador de calendario y la
// validación de cambios manuales.

export interface FieldBlockInput {
  fieldId: string;
  date: string; // YYYY-MM-DD
  timeSlotId: string | null;
}

export interface TeamRestrictionInput {
  teamId: string;
  date: string | null;
  timeSlotId: string | null;
  reason?: string | null;
}

export function isFieldBlocked(blocks: FieldBlockInput[], fieldId: string, date: string, timeSlotId: string): boolean {
  return blocks.some(
    (b) => b.fieldId === fieldId && b.date === date && (b.timeSlotId === null || b.timeSlotId === timeSlotId),
  );
}

/** Devuelve la restricción que impide al equipo jugar en esa fecha y horario, si existe. */
export function teamRestriction(
  restrictions: TeamRestrictionInput[],
  teamId: string,
  date: string,
  timeSlotId: string | null,
): TeamRestrictionInput | undefined {
  return restrictions.find((r) => {
    if (r.teamId !== teamId) return false;
    if (r.date === null && r.timeSlotId === null) return false;
    const dateMatch = r.date === null || r.date === date;
    const slotMatch = r.timeSlotId === null || r.timeSlotId === timeSlotId;
    return dateMatch && slotMatch;
  });
}

export function teamUnavailableAllDay(restrictions: TeamRestrictionInput[], teamId: string, date: string): boolean {
  return restrictions.some((r) => r.teamId === teamId && r.date === date && r.timeSlotId === null);
}
