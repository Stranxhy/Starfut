// DATOS DE DEMOSTRACIÓN — claramente identificados.
// Crea una temporada separada "[DEMO] …" (isDemo = true) con equipos, jugadores,
// árbitros, calendario generado por el algoritmo real y 13 jornadas con
// resultados simulados. Nada de esto modifica la temporada oficial.
//
//   npm run db:demo            → crea (o recrea) la temporada de demostración
//   npm run db:demo -- --clean → elimina la temporada de demostración

import { PrismaClient } from "@prisma/client";
import { createSeasonWithDefaults, ensureBase } from "./seed";
import { normalizeName } from "../src/domain/text";
import { seededRandom } from "../src/domain/roundRobin";
import { buildRoundDates } from "../src/domain/scheduler";
import { createDraft, confirmDraft } from "../src/server/services/schedule";
import { saveResult } from "../src/server/services/results";
import { cancelMatch, createMatch, freeSlots, updateMatch } from "../src/server/services/matches";
import { toISODate } from "../src/lib/dates";

const prisma = new PrismaClient();
const DEMO_NAME = "[DEMO] Temporada de demostración 2026";

// Equipos tomados de las imágenes de referencia (orden aproximado de fuerza).
const PREMIUM = [
  "Venus FC", "Cuauteboys FC", "Palmeiras", "Real Imperium", "Bayern", "Cheleros FC", "Newells", "Alemania",
  "Huracan", "Pilares FC", "Mas Fe Que Tecnica", "7 Maravillas", "Quekas FC", "Iron Wolves", "Deportivo Sobras",
  "Furia", "Renacidos FC", "Boca Jrs", "Guadalajara", "Putipuercoz", "Cinema", "Paris FC", "Galacticos",
  "Soccer Team", "Sullivan", "The Best Mex",
];
const LIGA2 = [
  "Deportivo Las Peñas", "Niupi", "Moscos Laguna", "Brasil", "AZ Mexico", "Real Gama", "Club Ticomán",
  "Atlético Norte", "Rayos", "Dinamo", "Halcones", "Lobos", "Toros",
];
const KNOWN_SCORERS: Record<string, string[]> = {
  "Venus FC": ["Ruben Arriaga", "Mario Arriaga", "Christopher Arriaga"],
  "Real Imperium": ["Osvani Escobar"],
  "7 Maravillas": ["Diego Sanchez"],
  "Cuauteboys FC": ["Mauricio Rosas"],
  Huracan: ["Kevin Romero"],
  Newells: ["Santiago Ruiz"],
  "Iron Wolves": ["Santi Melendez"],
  Palmeiras: ["Yael Rivero"],
};
const FIRST = ["Luis", "Jorge", "Carlos", "Miguel", "José", "Alejandro", "Fernando", "Ricardo", "Eduardo", "Javier", "Daniel", "Óscar", "Raúl", "Iván", "Emilio", "Hugo", "Arturo", "Pablo", "Sergio", "Andrés"];
const LAST = ["García", "Hernández", "López", "Martínez", "González", "Pérez", "Rodríguez", "Sánchez", "Ramírez", "Cruz", "Flores", "Gómez", "Morales", "Vázquez", "Reyes", "Jiménez", "Torres", "Díaz", "Gutiérrez", "Mendoza"];
const REFEREES = ["Árbitro Demo Alfonso Rivas", "Árbitro Demo Beatriz Luna", "Árbitro Demo César Ortega", "Árbitro Demo Diana Salas", "Árbitro Demo Ernesto Vidal", "Árbitro Demo Fabián Rojas"];

async function clean() {
  const seasons = await prisma.season.findMany({ where: { isDemo: true }, select: { id: true } });
  for (const { id } of seasons) {
    await prisma.$transaction(
      async (tx) => {
        await tx.sanction.deleteMany({ where: { seasonId: id } });
        await tx.matchScorer.deleteMany({ where: { match: { seasonId: id } } });
        await tx.playoffStage.deleteMany({ where: { seasonId: id } });
        await tx.standingSnapshot.deleteMany({ where: { seasonId: id } });
        await tx.match.updateMany({ where: { seasonId: id }, data: { replacesMatchId: null } });
        await tx.match.deleteMany({ where: { seasonId: id } });
        await tx.round.deleteMany({ where: { seasonId: id } });
        await tx.player.deleteMany({ where: { seasonId: id } });
        await tx.league.updateMany({ where: { seasonId: id }, data: { championTeamId: null } });
        await tx.team.deleteMany({ where: { seasonId: id } });
        await tx.league.deleteMany({ where: { seasonId: id } });
        await tx.season.delete({ where: { id } });
      },
      { timeout: 120_000 },
    );
  }
  await prisma.referee.deleteMany({ where: { isDemo: true } });
  if (seasons.length) console.log(`✔ Temporada de demostración eliminada.`);
}

async function main() {
  if (process.argv.includes("--clean")) {
    await clean();
    return;
  }
  await clean();
  const { tournament, venue } = await ensureBase(prisma);
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("Ejecuta primero `npm run db:seed` para crear el administrador.");
  const userId = admin.id;

  // Jornada 14 = próximo domingo; jornadas 1-13 ya disputadas.
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  do next.setUTCDate(next.getUTCDate() + 1);
  while (next.getUTCDay() !== 0);
  const start = new Date(next);
  start.setUTCDate(start.getUTCDate() - 13 * 7);

  const hasCurrent = await prisma.season.count({ where: { isCurrent: true } });
  const season = await createSeasonWithDefaults(prisma, {
    tournamentId: tournament.id,
    venueId: venue.id,
    name: DEMO_NAME,
    startDate: start,
    isCurrent: hasCurrent === 0,
    isDemo: true,
    leagueNames: ["Premium", "Liga 2"],
  });
  const leagues = await prisma.league.findMany({ where: { seasonId: season.id }, orderBy: { sortOrder: "asc" } });
  const rnd = seededRandom(2026);

  const strength = new Map<string, number>();
  for (const [li, names] of [PREMIUM, LIGA2].entries()) {
    for (const [i, name] of names.entries()) {
      const team = await prisma.team.create({
        data: {
          seasonId: season.id,
          leagueId: leagues[li].id,
          name,
          nameKey: normalizeName(name),
          isDemo: true,
          contactName: "Contacto demo",
        },
      });
      strength.set(team.id, 1 - i / names.length);
      const known = KNOWN_SCORERS[name] ?? [];
      const players = [...known];
      while (players.length < 10) {
        const n = `${FIRST[Math.floor(rnd() * FIRST.length)]} ${LAST[Math.floor(rnd() * LAST.length)]}`;
        if (!players.includes(n)) players.push(n);
      }
      for (const [pi, fullName] of players.entries()) {
        const p = await prisma.player.create({
          data: { seasonId: season.id, teamId: team.id, fullName, nameKey: normalizeName(fullName), jerseyNumber: pi + 1, isDemo: true },
        });
        await prisma.playerTeamHistory.create({ data: { playerId: p.id, teamId: team.id, fromDate: start } });
      }
    }
  }
  for (const name of REFEREES) {
    await prisma.referee.create({ data: { name, nameKey: normalizeName(name), isDemo: true } });
  }
  const referees = await prisma.referee.findMany({ where: { isDemo: true } });
  const dates = buildRoundDates(toISODate(start)!, 0, 14);
  // Un árbitro no disponible en la jornada 14 (demuestra la restricción).
  await prisma.refereeAvailability.create({
    data: { refereeId: referees[0].id, date: new Date(`${dates[13]}T00:00:00Z`), timeSlotId: null, available: false, note: "Demo: viaje" },
  });

  console.log("… generando calendario con el algoritmo real");
  const { draft, data } = await createDraft(
    season.id,
    { fromRound: 1, dates, seed: 20261011, leagueIds: leagues.map((l) => l.id) },
    userId,
  );
  console.log(`  ${data.summary.totalMatches} partidos, repetidos: ${data.summary.repeatedMatches}, conflictos: ${data.summary.conflicts}`);
  await confirmDraft(draft.id, { acknowledgeIssues: true }, userId);

  console.log("… simulando resultados de las jornadas 1–13");
  const matches = await prisma.match.findMany({
    where: { seasonId: season.id, round: { number: { lte: 13 } } },
    include: { homeTeam: { include: { players: true } }, awayTeam: { include: { players: true } }, round: true },
    orderBy: [{ date: "asc" }],
  });
  const goalsFor = (teamStr: number, oppStr: number) => {
    const lambda = Math.max(0.4, 2.6 + 3 * (teamStr - oppStr));
    let k = 0;
    let p = Math.exp(-lambda);
    let s = p;
    const u = rnd();
    while (u > s && k < 15) {
      k++;
      p *= lambda / k;
      s += p;
    }
    return k;
  };
  const pickScorers = (players: { id: string; jerseyNumber: number | null }[], goals: number) => {
    const out = new Map<string, number>();
    for (let g = 0; g < goals; g++) {
      if (rnd() < 0.15) continue; // gol sin autor conocido: no se inventa goleador
      const weights = players.map((p) => 1 / ((p.jerseyNumber ?? 5) ** 1.2));
      const total = weights.reduce((a, b) => a + b, 0);
      let r = rnd() * total;
      let idx = 0;
      while (r > weights[idx]) r -= weights[idx++];
      out.set(players[idx].id, (out.get(players[idx].id) ?? 0) + 1);
    }
    return out;
  };
  let cancelledOnce = false;
  for (const m of matches) {
    if (m.round?.number === 9 && !cancelledOnce) {
      cancelledOnce = true;
      await cancelMatch(m.id, "Demo: el equipo visitante avisó que no se presentaría", userId);
      // Partido de sustitución en el mismo espacio
      const sameDay = await prisma.match.findMany({ where: { seasonId: season.id, date: m.date, status: { not: "CANCELADO" } } });
      const busy = new Set(sameDay.flatMap((x) => [x.homeTeamId, x.awayTeamId]));
      const rival = await prisma.team.findFirst({
        where: { leagueId: m.leagueId!, id: { notIn: [...busy, m.homeTeamId, m.awayTeamId] } },
      });
      if (rival) {
        const sub = await createMatch(
          season.id,
          {
            type: "AMISTOSO",
            homeTeamId: m.homeTeamId,
            awayTeamId: rival.id,
            date: toISODate(m.date),
            timeSlotId: m.timeSlotId,
            fieldId: m.fieldId,
            refereeId: m.refereeId,
            replacesMatchId: m.id,
            notes: "Demo: amistoso para aprovechar el espacio",
          },
          { confirm: true, userId },
        );
        await saveResult(sub.match.id, { resultType: "TIEMPO_REGULAR", homeGoals: 3, awayGoals: 1, scorers: [] }, userId);
      }
      continue;
    }
    const hs = strength.get(m.homeTeamId)!;
    const as = strength.get(m.awayTeamId)!;
    const hg = goalsFor(hs, as);
    const ag = goalsFor(as, hs);
    const scorers = [
      ...[...pickScorers(m.homeTeam.players, hg)].map(([playerId, goals]) => ({ playerId, teamId: m.homeTeamId, goals })),
      ...[...pickScorers(m.awayTeam.players, ag)].map(([playerId, goals]) => ({ playerId, teamId: m.awayTeamId, goals })),
    ];
    if (hg === ag) {
      const homeWins = rnd() < 0.5 + (hs - as) / 2;
      const a = 3 + Math.floor(rnd() * 3);
      await saveResult(
        m.id,
        { resultType: "DESEMPATE", homeGoals: hg, awayGoals: ag, homeShootout: homeWins ? a : a - 1, awayShootout: homeWins ? a - 1 : a, scorers },
        userId,
      );
    } else {
      await saveResult(m.id, { resultType: "TIEMPO_REGULAR", homeGoals: hg, awayGoals: ag, scorers }, userId);
    }
  }

  // Reprogramación de un partido de la jornada 14 (cambio de horario).
  const j14 = await prisma.match.findMany({ where: { seasonId: season.id, round: { number: 14 } }, orderBy: { createdAt: "asc" } });
  if (j14.length) {
    const free = await freeSlots(season.id, dates[13]);
    const target = free.find((f) => f.timeSlotId !== j14[0].timeSlotId);
    if (target) {
      await updateMatch(
        j14[0].id,
        { timeSlotId: target.timeSlotId, fieldId: target.fieldId, refereeId: null, reason: "Demo: el equipo local solicitó cambio de horario" },
        { confirm: true, userId, markRescheduled: true },
      );
    }
  }

  // Sanciones de ejemplo
  const types = await prisma.sanctionType.findMany();
  const units = await prisma.sanctionUnit.findMany();
  const unit = (k: string) => units.find((u) => u.kind === k)!;
  const type = (n: string) => types.find((t) => t.name === n)!;
  const played = await prisma.match.findMany({
    where: { seasonId: season.id, status: "JUGADO", stage: "REGULAR", type: "OFICIAL" },
    include: { homeTeam: { include: { players: true } } },
    take: 40,
    orderBy: { date: "desc" },
  });
  const samples = [
    { t: "Expulsión", u: "PARTIDOS", d: 2, status: "ACTIVA" as const, reason: "Demo: juego brusco grave", serve: 1 },
    { t: "Conducta antideportiva", u: "MINUTOS", d: 20, status: "CUMPLIDA" as const, reason: "Demo: protestas reiteradas", serve: 0 },
    { t: "Agresión", u: "PARTIDOS", d: 4, status: "EN_REVISION" as const, reason: "Demo: altercado tras el silbatazo final", serve: 0 },
    { t: "Acumulación de amonestaciones", u: "PARTIDOS", d: 1, status: "CUMPLIDA" as const, reason: "Demo: cinco amonestaciones", serve: 1 },
    { t: "Otra", u: "DIAS", d: 15, status: "PENDIENTE" as const, reason: "Demo: falta administrativa", serve: 0 },
  ];
  for (const [i, s] of samples.entries()) {
    const m = played[i * 7];
    if (!m) break;
    const player = m.homeTeam.players[i + 1];
    const sanction = await prisma.sanction.create({
      data: {
        seasonId: season.id,
        playerId: player.id,
        teamId: m.homeTeamId,
        matchId: m.id,
        date: m.date!,
        typeId: type(s.t).id,
        unitId: unit(s.u).id,
        duration: s.d,
        reason: s.reason,
        status: s.status,
        notes: "Registro de demostración",
      },
    });
    if (s.serve) {
      const later = await prisma.match.findFirst({
        where: { OR: [{ homeTeamId: m.homeTeamId }, { awayTeamId: m.homeTeamId }], date: { gt: m.date! }, status: "JUGADO" },
        orderBy: { date: "asc" },
      });
      if (later) await prisma.sanctionServing.create({ data: { sanctionId: sanction.id, matchId: later.id, date: later.date! } });
    }
  }
  console.log(`✔ Temporada de demostración creada: "${DEMO_NAME}".`);
  if (hasCurrent) console.log("  Selecciónala desde el selector de temporada del panel para consultarla.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
