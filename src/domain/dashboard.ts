export interface DashboardProgress {
  activeLeagues: number;
  activeTeams: number;
  hasMatches: boolean;
  hasDraft: boolean;
  pendingResult: number;
  pendingResultDate: string | null;
  unscheduled: number;
  played: number;
  nextDate: string | null;
  today: string;
}

/** La acción de Inicio debe llevar al siguiente trabajo útil de la temporada. */
export function getDashboardAction(progress: DashboardProgress) {
  if (progress.pendingResult > 0) {
    return {
      title: "Pon los resultados al día",
      description: "Hay partidos de fechas anteriores sin marcador. Captúralos para actualizar la tabla y el goleo.",
      label: "Registrar resultados",
      href: progress.pendingResultDate ? `/resultados?date=${progress.pendingResultDate}` : "/resultados",
    };
  }
  if (progress.unscheduled > 0) {
    return {
      title: "Completa la programación",
      description: "Hay partidos pendientes de fecha, horario o cancha. Revisa lo que falta antes de la jornada.",
      label: "Programar partidos",
      href: "/partidos?estado=PENDIENTE",
    };
  }
  if (progress.hasDraft) {
    return {
      title: "Tu calendario está por confirmar",
      description: "Revisa los cruces y horarios del borrador antes de confirmar la programación.",
      label: "Revisar borrador",
      href: "/calendario",
    };
  }
  if (!progress.hasMatches) {
    if (progress.activeLeagues === 0) {
      return {
        title: "Prepara tu primera liga",
        description: "Crea o activa una liga para registrar a sus equipos y organizar la temporada.",
        label: "Configurar ligas",
        href: "/ligas",
      };
    }
    if (progress.activeTeams < 2) {
      return {
        title: "La temporada empieza con tus equipos",
        description: "Registra o activa los equipos participantes. Después podrás preparar el calendario y capturar resultados.",
        label: "Registrar equipos",
        href: "/equipos",
      };
    }
    return {
      title: "Prepara la primera jornada",
      description: "Tus equipos ya están registrados. Genera el calendario y revisa los cruces y horarios.",
      label: "Preparar calendario",
      href: "/calendario",
    };
  }
  if (progress.nextDate === progress.today) {
    return {
      title: "Hoy se juega",
      description: "Consulta los encuentros de hoy y registra sus resultados cuando terminen.",
      label: "Registrar resultados de hoy",
      href: `/resultados?date=${progress.today}`,
    };
  }
  if (progress.nextDate) {
    return {
      title: "Todo listo para la próxima fecha",
      description: "Consulta los partidos, horarios y canchas antes de la jornada.",
      label: "Ver próximos partidos",
      href: `/partidos?fecha=${progress.nextDate}`,
    };
  }
  return progress.played > 0
    ? {
        title: "Resultados al día",
        description: "No hay próximas fechas ni resultados atrasados. Consulta cómo va la clasificación.",
        label: "Ver tabla general",
        href: "/tabla",
      }
    : {
        title: "Revisa la programación",
        description: "No hay próximos partidos programados. Consulta el calendario para organizar la siguiente fecha.",
        label: "Ver calendario",
        href: "/calendario",
      };
}
