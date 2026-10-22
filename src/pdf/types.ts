/** Datos comunes a todos los documentos. */
export interface DocMeta {
  seasonId: string;
  seasonName: string;
  isDemo: boolean;
  tournament: string;
  /** Sede, p. ej. "Suc. Ticomán". */
  venue: string;
  generatedAt: Date;
  /** Fecha y hora de generación ya formateadas (zona horaria de la liga). */
  generatedLabel: string;
  /** Fecha de generación (YYYY-MM-DD) en la zona horaria de la liga. */
  generatedDate: string;
}

/** Error de parámetros: el endpoint responde 400 con este mensaje. */
export class PdfParamError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "PdfParamError";
  }
}
