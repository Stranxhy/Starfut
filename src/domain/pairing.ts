// Emparejamiento de equipos que se quedaron sin partido en una fecha
// (cancelaciones, descansos por número impar, bajas).
// 1. Primero se emparejan equipos de la misma liga.
// 2. Los sobrantes se combinan entre ligas para que nadie se quede sin jugar.
// En ambos casos se prefiere al rival con menos enfrentamientos previos.

export interface PairingTeam {
  id: string;
  name: string;
  leagueId: string;
}

export interface ProposedPair {
  home: string;
  away: string;
  crossLeague: boolean;
  previousMeetings: number;
}

function greedy(
  teams: PairingTeam[],
  meetings: (a: string, b: string) => number,
  allow: (a: PairingTeam, b: PairingTeam) => boolean,
): { pairs: [PairingTeam, PairingTeam][]; rest: PairingTeam[] } {
  const pool = [...teams].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const pairs: [PairingTeam, PairingTeam][] = [];
  const rest: PairingTeam[] = [];
  while (pool.length) {
    const t = pool.shift()!;
    let best = -1;
    for (let i = 0; i < pool.length; i++) {
      if (!allow(t, pool[i])) continue;
      if (best < 0 || meetings(t.id, pool[i].id) < meetings(t.id, pool[best].id)) best = i;
    }
    if (best < 0) rest.push(t);
    else pairs.push([t, pool.splice(best, 1)[0]]);
  }
  return { pairs, rest };
}

export function proposePairings(
  teams: PairingTeam[],
  meetings: (a: string, b: string) => number = () => 0,
): { pairs: ProposedPair[]; unpaired: PairingTeam[] } {
  const same = greedy(teams, meetings, (a, b) => a.leagueId === b.leagueId);
  const cross = greedy(same.rest, meetings, (a, b) => a.leagueId !== b.leagueId);
  const toPair = ([a, b]: [PairingTeam, PairingTeam]): ProposedPair => ({
    home: a.id,
    away: b.id,
    crossLeague: a.leagueId !== b.leagueId,
    previousMeetings: meetings(a.id, b.id),
  });
  return { pairs: [...same.pairs.map(toPair), ...cross.pairs.map(toPair)], unpaired: cross.rest };
}
