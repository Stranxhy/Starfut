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

export interface RefereeAvailabilityInput {
  refereeId: string;
  date: string;
  timeSlotId: string | null;
  available: boolean;
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

/**
 * Un árbitro activo está disponible salvo que exista un registro de NO
 * disponibilidad para esa fecha (todo el día) o para ese horario.
 */
export function isRefereeAvailable(
  availability: RefereeAvailabilityInput[],
  refereeId: string,
  date: string,
  timeSlotId: string,
): boolean {
  const records = availability.filter((a) => a.refereeId === refereeId && a.date === date);
  const slotRecord = records.find((a) => a.timeSlotId === timeSlotId);
  if (slotRecord) return slotRecord.available;
  const dayRecord = records.find((a) => a.timeSlotId === null);
  if (dayRecord) return dayRecord.available;
  return true;
}
