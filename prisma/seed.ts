// Datos iniciales de configuración (no son datos de demostración).
// Es idempotente: puede ejecutarse varias veces sin duplicar registros.
//   npm run db:seed

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { DEFAULT_BRACKET } from "../src/domain/bracket";
import { DEFAULT_TIEBREAKERS } from "../src/domain/standings";

const prisma = new PrismaClient();

export const INITIAL_TIMES = ["08:10", "09:00", "09:50", "10:40", "11:30", "12:20"];
export const INITIAL_FIELDS = ["Cancha 1", "Cancha 2", "Cancha 3", "Cancha 4", "Cancha 5"];

function nextSunday(): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== 0);
  return d;
}

export async function ensureCatalogs(db: PrismaClient) {
  const types = ["Expulsión", "Acumulación de amonestaciones", "Conducta antideportiva", "Agresión", "Otra"];
  for (const name of types) await db.sanctionType.upsert({ where: { name }, create: { name }, update: {} });
  const units = [
    { name: "Partidos de suspensión", kind: "PARTIDOS" as const },
    { name: "Minutos de juego", kind: "MINUTOS" as const },
    { name: "Días", kind: "DIAS" as const },
  ];
  for (const u of units) await db.sanctionUnit.upsert({ where: { name: u.name }, create: u, update: {} });
}

/** Crea una temporada con la configuración inicial (horarios, ligas, reglas y cuadro). */
export async function createSeasonWithDefaults(
  db: PrismaClient,
  opts: { tournamentId: string; venueId: string; name: string; startDate: Date; isCurrent: boolean; isDemo?: boolean; leagueNames: string[] },
) {
  const season = await db.season.create({
    data: {
      tournamentId: opts.tournamentId,
      venueId: opts.venueId,
      name: opts.name,
      startDate: opts.startDate,
      weekday: 0,
      regularRounds: 14,
      // La liga combina equipos de ambas ligas cuando alguno se queda sin partido.
      allowInterLeague: true,
      isCurrent: opts.isCurrent,
      isDemo: opts.isDemo ?? false,
      timeSlots: { create: INITIAL_TIMES.map((t, i) => ({ startTime: t, sortOrder: i, durationMinutes: 50 })) },
      scoringConfigs: {
        create: { winPoints: 3, lossPoints: 0, shootoutWinPoints: 2, shootoutLossPoints: 1, allowDraws: false, drawPoints: null },
      },
      tiebreakConfigs: { create: { criteria: DEFAULT_TIEBREAKERS, scorerCriteria: [] } },
    },
  });
  for (const [i, name] of opts.leagueNames.entries()) {
    const league = await db.league.create({ data: { seasonId: season.id, name, sortOrder: i } });
    await db.playoffFormat.create({
      data: { seasonId: season.id, leagueId: league.id, stages: JSON.parse(JSON.stringify(DEFAULT_BRACKET)), zones: [], officialConfirmed: true },
    });
  }
  return season;
}

export async function ensureBase(db: PrismaClient) {
  const tournament =
    (await db.tournament.findFirst()) ?? (await db.tournament.create({ data: { name: "Starfutbol", modality: "Futbol 7" } }));
  const venue =
    (await db.venue.findFirst({ where: { tournamentId: tournament.id } })) ??
    (await db.venue.create({ data: { tournamentId: tournament.id, name: "Suc. Ticomán" } }));
  for (const [i, name] of INITIAL_FIELDS.entries()) {
    await db.field.upsert({
      where: { venueId_name: { venueId: venue.id, name } },
      create: { venueId: venue.id, name, sortOrder: i },
      update: {},
    });
  }
  await ensureCatalogs(db);
  return { tournament, venue };
}

async function main() {
  const { tournament, venue } = await ensureBase(prisma);

  const officialSeasons = await prisma.season.count({ where: { isDemo: false } });
  if (officialSeasons === 0) {
    const hasCurrent = await prisma.season.count({ where: { isCurrent: true } });
    await createSeasonWithDefaults(prisma, {
      tournamentId: tournament.id,
      venueId: venue.id,
      name: `Temporada ${new Date().getFullYear()}`,
      startDate: nextSunday(),
      isCurrent: hasCurrent === 0,
      leagueNames: ["Premium", "Liga 2"],
    });
    console.log("✔ Temporada inicial creada (2 ligas, 14 jornadas, 6 horarios, 5 canchas).");
  }

  const email = (process.env.ADMIN_EMAIL || "admin@starfutbol.local").toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    let password = process.env.ADMIN_PASSWORD;
    let generated = false;
    if (!password) {
      password = crypto.randomBytes(9).toString("base64url");
      generated = true;
    }
    await prisma.user.create({
      data: {
        email,
        name: process.env.ADMIN_NAME || "Administrador",
        role: "ADMIN",
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
    console.log(`✔ Usuario administrador creado: ${email}`);
    if (generated) console.log(`  Contraseña generada (cámbiala al iniciar sesión): ${password}`);
  }
  console.log("✔ Configuración inicial lista.");
}

if (process.argv[1]?.split("\\").join("/").endsWith("prisma/seed.ts")) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
