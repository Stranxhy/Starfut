// Cuadro de eliminatorias configurable.
//
// Cada cruce define sus participantes mediante "orígenes":
//   S5            → equipo en 5.º lugar de la clasificación final congelada
//   W:REPECHAJE:1 → ganador del cruce 1 de la etapa REPECHAJE
//   L:SEMIFINAL:2 → perdedor del cruce 2 de la etapa SEMIFINAL

export interface BracketTie {
  home: string;
  away: string;
}

export interface BracketStage {
  code: string;
  name: string;
  ties: BracketTie[];
}

export interface BracketFormat {
  stages: BracketStage[];
}

export interface Zone {
  positions: number[];
  label: string;
  color: string;
}

/**
 * Cuadro oficial de Starfutbol (confirmado por la liga): 1.º–4.º directo a
 * cuartos; repechaje 5-12, 6-11, 7-10, 8-9; cuartos 1 vs gan. 8-9, 2 vs gan. 7-10,
 * 3 vs gan. 6-11, 4 vs gan. 5-12; semifinales C1-C4 y C2-C3; final. A un partido.
 */
export const DEFAULT_BRACKET: BracketFormat = {
  stages: [
    {
      code: "REPECHAJE",
      name: "Repechaje",
      ties: [
        { home: "S5", away: "S12" },
        { home: "S6", away: "S11" },
        { home: "S7", away: "S10" },
        { home: "S8", away: "S9" },
      ],
    },
    {
      code: "CUARTOS",
      name: "Cuartos de final",
      ties: [
        { home: "S1", away: "W:REPECHAJE:4" },
        { home: "S2", away: "W:REPECHAJE:3" },
        { home: "S3", away: "W:REPECHAJE:2" },
        { home: "S4", away: "W:REPECHAJE:1" },
      ],
    },
    {
      code: "SEMIFINAL",
      name: "Semifinales",
      ties: [
        { home: "W:CUARTOS:1", away: "W:CUARTOS:4" },
        { home: "W:CUARTOS:2", away: "W:CUARTOS:3" },
      ],
    },
    { code: "FINAL", name: "Final", ties: [{ home: "W:SEMIFINAL:1", away: "W:SEMIFINAL:2" }] },
  ],
};

export const ZONE_PALETTE = ["#5B7CF5", "#B467E0", "#F5B041", "#B8BCC2", "#E57373", "#4DD0E1", "#AED581", "#F06292"];
export const DIRECT_COLOR = "#7BE04B";

export type ParsedSource =
  | { kind: "seed"; position: number }
  | { kind: "winner" | "loser"; stage: string; tie: number };

export function parseSource(src: string): ParsedSource | null {
  const s = src.trim().toUpperCase();
  let m = /^S(\d{1,3})$/.exec(s);
  if (m) return { kind: "seed", position: Number(m[1]) };
  m = /^([WL]):([A-Z0-9_]+):(\d{1,2})$/.exec(s);
  if (m) return { kind: m[1] === "W" ? "winner" : "loser", stage: m[2], tie: Number(m[3]) };
  return null;
}

export function describeSource(src: string, stageNames: Record<string, string> = {}): string {
  const p = parseSource(src);
  if (!p) return src;
  if (p.kind === "seed") return `${p.position}.º lugar`;
  const name = stageNames[p.stage] ?? p.stage;
  return `${p.kind === "winner" ? "Ganador" : "Perdedor"} ${name} ${p.tie}`;
}

/** Valida la estructura del cuadro frente al número de equipos de la liga. */
export function validateBracket(format: BracketFormat, teamCount: number): string[] {
  const errors: string[] = [];
  const seen = new Map<string, number>(); // code → número de cruces
  const codes = new Set<string>();
  if (!format.stages.length) errors.push("El cuadro no tiene etapas.");
  format.stages.forEach((stage, si) => {
    if (!/^[A-Z0-9_]+$/.test(stage.code)) errors.push(`Código de etapa inválido: "${stage.code}".`);
    if (codes.has(stage.code)) errors.push(`La etapa ${stage.code} está repetida.`);
    codes.add(stage.code);
    if (!stage.ties.length) errors.push(`La etapa ${stage.name} no tiene cruces.`);
    const usedInStage = new Set<string>();
    stage.ties.forEach((tie, ti) => {
      for (const src of [tie.home, tie.away]) {
        const p = parseSource(src);
        const where = `${stage.name}, cruce ${ti + 1}`;
        if (!p) {
          errors.push(`${where}: origen inválido "${src}".`);
          continue;
        }
        const k = src.trim().toUpperCase();
        if (usedInStage.has(k)) errors.push(`${where}: "${describeSource(k)}" aparece dos veces en la misma etapa.`);
        usedInStage.add(k);
        if (p.kind === "seed") {
          if (p.position < 1) errors.push(`${where}: posición inválida.`);
          else if (p.position > teamCount)
            errors.push(`${where}: requiere el ${p.position}.º lugar, pero la liga solo tiene ${teamCount} equipos.`);
        } else {
          const prev = seen.get(p.stage);
          if (prev === undefined) errors.push(`${where}: la etapa ${p.stage} no existe o es posterior.`);
          else if (p.tie < 1 || p.tie > prev) errors.push(`${where}: la etapa ${p.stage} no tiene cruce ${p.tie}.`);
        }
      }
      if (tie.home.trim().toUpperCase() === tie.away.trim().toUpperCase())
        errors.push(`${stage.name}, cruce ${ti + 1}: ambos lados tienen el mismo origen.`);
    });
    seen.set(stage.code, stage.ties.length);
    void si;
  });
  return errors;
}

export interface StageOutcome {
  /** Por número de cruce (1-based): ganador y perdedor, o null si no se conoce. */
  winners: (string | null)[];
  losers: (string | null)[];
}

/** Resuelve un origen. Devuelve null si el participante todavía no se conoce. */
export function resolveSource(
  src: string,
  seeds: string[],
  outcomes: Record<string, StageOutcome>,
): string | null {
  const p = parseSource(src);
  if (!p) return null;
  if (p.kind === "seed") return seeds[p.position - 1] ?? null;
  const o = outcomes[p.stage];
  if (!o) return null;
  return (p.kind === "winner" ? o.winners : o.losers)[p.tie - 1] ?? null;
}

/** Zonas de color por defecto derivadas del cuadro (adaptadas al número de equipos). */
export function defaultZones(format: BracketFormat, teamCount: number): Zone[] {
  const first = format.stages[0];
  const firstSeeds = new Set<number>();
  const zones: Zone[] = [];
  if (first) {
    first.ties.forEach((t, i) => {
      const a = parseSource(t.home);
      const b = parseSource(t.away);
      const positions = [a, b]
        .filter((p): p is { kind: "seed"; position: number } => p?.kind === "seed")
        .map((p) => p.position)
        .filter((p) => p <= teamCount);
      positions.forEach((p) => firstSeeds.add(p));
      if (positions.length) {
        zones.push({
          positions,
          label: `${first.name}: ${positions.map((p) => `${p}.º`).join(" vs ")}`,
          color: ZONE_PALETTE[i % ZONE_PALETTE.length],
        });
      }
    });
  }
  const direct = new Set<number>();
  let directStage: BracketStage | undefined;
  for (const stage of format.stages.slice(1)) {
    for (const t of stage.ties) {
      for (const s of [t.home, t.away]) {
        const p = parseSource(s);
        if (p?.kind === "seed" && p.position <= teamCount && !firstSeeds.has(p.position)) {
          direct.add(p.position);
          directStage ??= stage;
        }
      }
    }
  }
  if (direct.size) {
    zones.unshift({
      positions: [...direct].sort((a, b) => a - b),
      label: `Clasificación directa${directStage ? ` a ${directStage.name.toLowerCase()}` : ""}`,
      color: DIRECT_COLOR,
    });
  }
  return zones;
}

export function zoneForPosition(zones: Zone[], position: number): Zone | undefined {
  return zones.find((z) => z.positions.includes(position));
}

/** Etapas cuyas fuentes ya se conocen todas (se pueden generar). */
export function stageReady(stage: BracketStage, seeds: string[], outcomes: Record<string, StageOutcome>): boolean {
  return stage.ties.every(
    (t) => resolveSource(t.home, seeds, outcomes) !== null && resolveSource(t.away, seeds, outcomes) !== null,
  );
}
