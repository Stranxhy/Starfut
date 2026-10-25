// Etiquetas en español y estilos para los estados del sistema (seguro para cliente).

export const MATCH_STATUS: Record<string, { label: string; className: string }> = {
  PENDIENTE: { label: "Pendiente", className: "bg-amber-100 text-amber-900 ring-amber-300" },
  PROGRAMADO: { label: "Programado", className: "bg-sky-100 text-sky-900 ring-sky-300" },
  JUGADO: { label: "Disputado", className: "bg-emerald-100 text-emerald-900 ring-emerald-300" },
  CANCELADO: { label: "Cancelado", className: "bg-zinc-200 text-zinc-700 ring-zinc-300 line-through" },
  REPROGRAMADO: { label: "Reprogramado", className: "bg-violet-100 text-violet-900 ring-violet-300" },
};

export const MATCH_TYPE: Record<string, { label: string; short: string; description: string }> = {
  OFICIAL: { label: "Oficial de liga", short: "Oficial", description: "Partido oficial de la fase regular. Cuenta para la clasificación." },
  SUSTITUCION: {
    label: "Sustitución (cuenta para la tabla)",
    short: "Sustitución",
    description: "Ocupa el espacio de un partido cancelado y cuenta para la clasificación.",
  },
  AMISTOSO: { label: "Amistoso", short: "Amistoso", description: "Solo para un partido que la liga declare amistoso: no cuenta para la tabla." },
  INTERLIGA: {
    label: "Combinado entre ligas",
    short: "Entre ligas",
    description: "Enfrenta a equipos de ligas diferentes. Cuenta para la tabla de la liga de cada equipo.",
  },
  ELIMINATORIA: { label: "Eliminatoria", short: "Eliminatoria", description: "Partido de la fase final." },
};

export const RESULT_TYPE: Record<string, string> = {
  TIEMPO_REGULAR: "Tiempo regular",
  DESEMPATE: "Empate + desempate (penales)",
  EMPATE: "Empate definitivo",
  ADMINISTRATIVO: "Decisión administrativa oficial",
};

export const SANCTION_STATUS: Record<string, { label: string; className: string }> = {
  ACTIVA: { label: "Activa", className: "bg-red-100 text-red-900 ring-red-300" },
  PENDIENTE: { label: "Pendiente", className: "bg-amber-100 text-amber-900 ring-amber-300" },
  CUMPLIDA: { label: "Cumplida", className: "bg-emerald-100 text-emerald-900 ring-emerald-300" },
  CANCELADA: { label: "Cancelada", className: "bg-zinc-200 text-zinc-700 ring-zinc-300" },
  EN_REVISION: { label: "En revisión", className: "bg-sky-100 text-sky-900 ring-sky-300" },
};

export const UNIT_KIND: Record<string, string> = {
  PARTIDOS: "Partidos",
  MINUTOS: "Minutos de juego",
  DIAS: "Días",
  OTRA: "Otra unidad",
};

export const SEASON_STATUS: Record<string, string> = {
  CONFIGURACION: "En configuración",
  EN_CURSO: "En curso",
  FASE_REGULAR_CERRADA: "Fase regular cerrada",
  FINALIZADA: "Finalizada",
};

export const ROLE: Record<string, string> = {
  ADMIN: "Administrador",
  AUXILIAR: "Auxiliar (resultados)",
  CONSULTA: "Consulta",
};

export const STAGE_STATUS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  GENERADA: "Generada",
  COMPLETADA: "Completada",
};

/** Abreviaturas de la tabla general (mismas en panel y PDF). */
export const STANDING_ABBR: Record<string, string> = {
  JJ: "Partidos jugados",
  JG: "Partidos ganados en tiempo regular",
  JP: "Partidos perdidos en tiempo regular",
  EG: "Empates ganados: victoria en el desempate (penales)",
  EP: "Empates perdidos: derrota en el desempate (penales)",
  E: "Empates definitivos (solo si la liga los permite)",
  GF: "Goles a favor (tiempo regular; no incluye penales)",
  GE: "Goles en contra (tiempo regular; no incluye penales)",
  DIF: "Diferencia de goles (GF − GE)",
  PTS: "Puntos",
};

export const AUDIT_ACTION: Record<string, string> = {
  CREAR: "Alta",
  EDITAR: "Edición",
  DESACTIVAR: "Baja / desactivación",
  ACTIVAR: "Reactivación",
  ELIMINAR: "Eliminación",
  PROGRAMAR: "Cambio de programación",
  CANCELAR: "Cancelación",
  REPROGRAMAR: "Reprogramación",
  CAMBIO_RIVALES: "Cambio de contrincantes",
  RESULTADO: "Resultado registrado",
  CORRECCION_RESULTADO: "Corrección de resultado",
  REVERTIR_RESULTADO: "Resultado revertido",
  CALENDARIO_CONFIRMADO: "Calendario confirmado",
  DESBLOQUEAR: "Desbloqueo de jornada",
  CIERRE_FASE_REGULAR: "Cierre de fase regular",
  ELIMINATORIA: "Eliminatorias",
  CONFIGURACION: "Configuración",
  SANCION: "Sanción",
  LOGIN: "Inicio de sesión",
  RESPALDO: "Respaldo",
};
