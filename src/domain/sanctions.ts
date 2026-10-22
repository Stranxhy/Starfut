// Control de cumplimiento de sanciones. No convierte unidades ni aplica
// reglas disciplinarias: solo lleva la cuenta de lo registrado.

export type SanctionStatusCode = "ACTIVA" | "PENDIENTE" | "CUMPLIDA" | "CANCELADA" | "EN_REVISION";
export type SanctionUnitKindCode = "PARTIDOS" | "MINUTOS" | "DIAS" | "OTRA";

export interface SanctionProgress {
  served: number;
  remaining: number | null;
  /** Solo las sanciones por partidos se completan automáticamente al registrar cumplimientos. */
  complete: boolean;
}

export function sanctionProgress(kind: SanctionUnitKindCode, duration: number, servedCount: number): SanctionProgress {
  if (kind !== "PARTIDOS") return { served: servedCount, remaining: null, complete: false };
  const remaining = Math.max(0, duration - servedCount);
  return { served: servedCount, remaining, complete: remaining === 0 };
}

/** Estado sugerido tras registrar o revertir un cumplimiento de una sanción por partidos. */
export function nextStatusAfterServing(
  current: SanctionStatusCode,
  kind: SanctionUnitKindCode,
  duration: number,
  servedCount: number,
): SanctionStatusCode {
  if (current === "CANCELADA" || current === "EN_REVISION") return current;
  const p = sanctionProgress(kind, duration, servedCount);
  if (kind !== "PARTIDOS") return current;
  if (p.complete) return "CUMPLIDA";
  return current === "CUMPLIDA" ? "ACTIVA" : current;
}
