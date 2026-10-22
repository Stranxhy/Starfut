// Exportación completa de la base de datos en JSON (respaldo lógico descargable).
// El respaldo principal y su restauración se hacen con pg_dump/pg_restore
// (ver scripts/backup.mjs y docs). Este archivo es un complemento portátil.
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth";
import { audit } from "@/server/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (user.role !== "ADMIN") return new Response("Prohibido", { status: 403 });
  const [
    tournaments, venues, fields, seasons, timeSlots, fieldBlocks, leagues, scoringConfigs, tiebreakConfigs, teams,
    teamRestrictions, players, playerTeamHistory, referees, refereeAvailability, rounds, matches, matchResults,
    matchScorers, sanctionTypes, sanctionUnits, sanctions, sanctionServings, playoffFormats, standingSnapshots,
    playoffStages, playoffTies, users, auditLogs,
  ] = await Promise.all([
    prisma.tournament.findMany(), prisma.venue.findMany(), prisma.field.findMany(), prisma.season.findMany(),
    prisma.timeSlot.findMany(), prisma.fieldBlock.findMany(), prisma.league.findMany(), prisma.scoringConfig.findMany(),
    prisma.tiebreakConfig.findMany(), prisma.team.findMany({ omit: { logo: true } }), prisma.teamRestriction.findMany(),
    prisma.player.findMany(), prisma.playerTeamHistory.findMany(), prisma.referee.findMany(), prisma.refereeAvailability.findMany(),
    prisma.round.findMany(), prisma.match.findMany(), prisma.matchResult.findMany(), prisma.matchScorer.findMany(),
    prisma.sanctionType.findMany(), prisma.sanctionUnit.findMany(), prisma.sanction.findMany(), prisma.sanctionServing.findMany(),
    prisma.playoffFormat.findMany(), prisma.standingSnapshot.findMany(), prisma.playoffStage.findMany(), prisma.playoffTie.findMany(),
    prisma.user.findMany({ omit: { passwordHash: true } }), prisma.auditLog.findMany(),
  ]);
  const payload = {
    formato: "starfutbol-respaldo-json",
    version: 1,
    generado: new Date().toISOString(),
    nota: "Respaldo lógico sin contraseñas ni escudos. Para restauración completa use pg_dump/pg_restore.",
    datos: {
      tournaments, venues, fields, seasons, timeSlots, fieldBlocks, leagues, scoringConfigs, tiebreakConfigs, teams,
      teamRestrictions, players, playerTeamHistory, referees, refereeAvailability, rounds, matches, matchResults,
      matchScorers, sanctionTypes, sanctionUnits, sanctions, sanctionServings, playoffFormats, standingSnapshots,
      playoffStages, playoffTies, users, auditLogs,
    },
  };
  await audit(prisma, { userId: user.id, action: "RESPALDO", entity: "Sistema", summary: "Descarga de respaldo JSON" });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return new Response(JSON.stringify(payload, null, 1), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="Starfutbol_Respaldo_${stamp}.json"`,
    },
  });
}
