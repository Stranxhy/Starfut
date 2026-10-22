// Reglas de puntuación y validación de resultados.
// Módulo puro (sin acceso a base de datos) para poder probarlo de forma aislada.

export type ResultTypeCode = "TIEMPO_REGULAR" | "DESEMPATE" | "EMPATE" | "ADMINISTRATIVO";

export interface ScoringRules {
  winPoints: number;
  lossPoints: number;
  shootoutWinPoints: number;
  shootoutLossPoints: number;
  allowDraws: boolean;
  drawPoints: number | null;
  /** Tiros por equipo antes de la muerte súbita (null = no se valida el marcador de penales). */
  shootoutKicks?: number | null;
}

export const DEFAULT_SCORING: ScoringRules = {
  winPoints: 3,
  lossPoints: 0,
  shootoutWinPoints: 2,
  shootoutLossPoints: 1,
  allowDraws: false,
  drawPoints: null,
  shootoutKicks: 3,
};

/**
 * Valida que un marcador de penales sea posible con N tiros por equipo y
 * muerte súbita: durante los N tiros la tanda puede terminar con ventaja de 2
 * o más (el ganador nunca supera N goles); en muerte súbita termina con
 * diferencia exacta de 1.
 */
export function shootoutProblem(home: number, away: number, kicks: number | null | undefined): string | null {
  if (!kicks) return null;
  const w = Math.max(home, away);
  const l = Math.min(home, away);
  if (w - l >= 2 && w > kicks) {
    return `Marcador de penales imposible (${home}-${away}): con ${kicks} tiros por equipo y muerte súbita, una diferencia de 2 o más solo ocurre dentro de los primeros ${kicks} tiros, cuando el ganador anotó ${kicks} o menos.`;
  }
  return null;
}

export interface ResultInput {
  resultType: ResultTypeCode;
  /** Goles del tiempo regular (los penales no se suman). */
  homeGoals: number;
  awayGoals: number;
  homeShootout?: number | null;
  awayShootout?: number | null;
  /** Obligatorio en ADMINISTRATIVO; opcional en DESEMPATE si no se conoce el marcador de penales. */
  winnerTeamId?: string | null;
}

export interface TeamOutcome {
  played: number;
  won: number;
  lost: number;
  shootoutWon: number;
  shootoutLost: number;
  drawn: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface ValidatedResult extends ResultInput {
  winnerTeamId: string | null;
}

function isNonNegInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0;
}

/**
 * Valida un resultado y determina el ganador. Devuelve errores comprensibles
 * en lugar de inventar un resultado.
 */
export function validateResult(
  input: ResultInput,
  homeTeamId: string,
  awayTeamId: string,
  rules: ScoringRules,
): { ok: true; value: ValidatedResult } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const { resultType, homeGoals, awayGoals } = input;
  if (!isNonNegInt(homeGoals) || !isNonNegInt(awayGoals)) {
    errors.push("Los goles deben ser números enteros iguales o mayores que cero.");
    return { ok: false, errors };
  }
  let winner: string | null = null;

  switch (resultType) {
    case "TIEMPO_REGULAR":
      if (homeGoals === awayGoals) {
        errors.push(
          "El marcador está empatado: registra el resultado como desempate" +
            (rules.allowDraws ? " o como empate definitivo." : "."),
        );
      } else winner = homeGoals > awayGoals ? homeTeamId : awayTeamId;
      break;

    case "DESEMPATE": {
      if (homeGoals !== awayGoals) {
        errors.push("Un desempate solo procede cuando el tiempo regular terminó empatado.");
        break;
      }
      const hs = input.homeShootout;
      const as = input.awayShootout;
      const hasShootout = hs != null || as != null;
      if (hasShootout) {
        if (!isNonNegInt(hs) || !isNonNegInt(as)) {
          errors.push("Captura ambos marcadores del desempate (penales) como enteros.");
        } else if (hs === as) {
          errors.push("El marcador del desempate no puede terminar empatado.");
        } else if (shootoutProblem(hs, as, rules.shootoutKicks)) {
          errors.push(shootoutProblem(hs, as, rules.shootoutKicks)!);
        } else {
          winner = hs > as ? homeTeamId : awayTeamId;
          if (input.winnerTeamId && input.winnerTeamId !== winner) {
            errors.push("El ganador indicado no coincide con el marcador del desempate.");
          }
        }
      } else if (input.winnerTeamId === homeTeamId || input.winnerTeamId === awayTeamId) {
        winner = input.winnerTeamId;
      } else {
        errors.push("Indica el marcador de penales o, al menos, qué equipo ganó el desempate.");
      }
      break;
    }

    case "EMPATE":
      if (!rules.allowDraws || rules.drawPoints == null) {
        errors.push(
          "El empate definitivo no está habilitado o no tiene puntos configurados. Configúralo en Reglas de puntuación.",
        );
      } else if (homeGoals !== awayGoals) {
        errors.push("Un empate definitivo requiere el mismo número de goles.");
      }
      break;

    case "ADMINISTRATIVO":
      if (input.winnerTeamId !== homeTeamId && input.winnerTeamId !== awayTeamId) {
        errors.push("Una decisión administrativa debe indicar el equipo ganador.");
      } else winner = input.winnerTeamId;
      break;

    default:
      errors.push("Tipo de resultado no válido.");
  }

  if (errors.length) return { ok: false, errors };
  const value: ValidatedResult = {
    ...input,
    homeShootout: resultType === "DESEMPATE" ? (input.homeShootout ?? null) : null,
    awayShootout: resultType === "DESEMPATE" ? (input.awayShootout ?? null) : null,
    winnerTeamId: winner,
  };
  return { ok: true, value };
}

/** Calcula lo que aporta un resultado oficial a cada equipo. */
export function outcomeFor(
  result: ValidatedResult,
  teamId: string,
  homeTeamId: string,
  rules: ScoringRules,
): TeamOutcome {
  const isHome = teamId === homeTeamId;
  const gf = isHome ? result.homeGoals : result.awayGoals;
  const ga = isHome ? result.awayGoals : result.homeGoals;
  const o: TeamOutcome = {
    played: 1,
    won: 0,
    lost: 0,
    shootoutWon: 0,
    shootoutLost: 0,
    drawn: 0,
    goalsFor: gf,
    goalsAgainst: ga,
    points: 0,
  };
  const winner = result.winnerTeamId;
  switch (result.resultType) {
    case "TIEMPO_REGULAR":
    case "ADMINISTRATIVO":
      if (winner === teamId) {
        o.won = 1;
        o.points = rules.winPoints;
      } else {
        o.lost = 1;
        o.points = rules.lossPoints;
      }
      break;
    case "DESEMPATE":
      if (winner === teamId) {
        o.shootoutWon = 1;
        o.points = rules.shootoutWinPoints;
      } else {
        o.shootoutLost = 1;
        o.points = rules.shootoutLossPoints;
      }
      break;
    case "EMPATE":
      o.drawn = 1;
      o.points = rules.drawPoints ?? 0;
      break;
  }
  return o;
}
