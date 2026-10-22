// Generación de enfrentamientos "todos contra todos" (método del círculo).

export type Pairing = { home: string; away: string };
export type RoundPairings = { pairings: Pairing[]; bye: string | null };

/** Generador pseudoaleatorio determinista (mulberry32) para poder regenerar calendarios. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rnd: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Una vuelta completa: con n equipos (n par) se generan n-1 jornadas en las que
 * cada equipo enfrenta a todos los demás exactamente una vez. Con n impar se
 * agrega un "descanso" y se generan n jornadas; cada equipo descansa una vez.
 */
export function circleRoundRobin(teamIds: string[]): RoundPairings[] {
  if (teamIds.length < 2) return [];
  const BYE = "__BYE__";
  const list = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, BYE];
  const n = list.length;
  const rounds: RoundPairings[] = [];
  const fixed = list[0];
  let rotating = list.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const current = [fixed, ...rotating];
    const pairings: Pairing[] = [];
    let bye: string | null = null;
    for (let i = 0; i < n / 2; i++) {
      const a = current[i];
      const b = current[n - 1 - i];
      if (a === BYE || b === BYE) {
        bye = a === BYE ? b : a;
        continue;
      }
      // Alternar localía para equilibrar.
      const swap = i === 0 ? r % 2 === 1 : (r + i) % 2 === 1;
      pairings.push(swap ? { home: b, away: a } : { home: a, away: b });
    }
    rounds.push({ pairings, bye });
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }
  return rounds;
}

/** Número de jornadas que componen una vuelta completa sin repetir rivales. */
export function roundsPerCycle(teamCount: number): number {
  if (teamCount < 2) return 0;
  return teamCount % 2 === 0 ? teamCount - 1 : teamCount;
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Genera `roundCount` jornadas. Mientras sea posible, ningún enfrentamiento se
 * repite; si se requieren más jornadas que una vuelta completa, las jornadas
 * adicionales provienen de una segunda vuelta con la localía invertida.
 */
export function generateLeagueRounds(teamIds: string[], roundCount: number, rnd: () => number): RoundPairings[] {
  const ordered = shuffle(teamIds, rnd);
  const cycle = circleRoundRobin(ordered);
  if (cycle.length === 0) return [];
  const out: RoundPairings[] = [];
  let cycleIndex = 0;
  while (out.length < roundCount) {
    const order = cycleIndex === 0 ? cycle : shuffle(cycle, rnd);
    for (const r of order) {
      if (out.length >= roundCount) break;
      out.push(
        cycleIndex % 2 === 0
          ? r
          : { bye: r.bye, pairings: r.pairings.map((p) => ({ home: p.away, away: p.home })) },
      );
    }
    cycleIndex++;
  }
  return out;
}
