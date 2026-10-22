import "server-only";
import { prisma } from "@/lib/prisma";
import { fromISODate, todayISO, toISODate } from "@/lib/dates";
import { isRefereeAvailable } from "@/domain/availability";
import { getLeagueScorers, getLeagueStandings } from "./standings";
import { teamsWithoutMatch } from "./matches";

export interface DashboardAlert {
  tone: "warn" | "danger" | "info";
  text: string;
  href?: string;
}

export async function getDashboard(seasonId: string) {
  const today = fromISODate(todayISO());
  const season = await prisma.season.findUniqueOrThrow({
    where: { id: seasonId },
    include: { leagues: { orderBy: { sortOrder: "asc" } } },
  });
  const notCancelled = { seasonId, status: { not: "CANCELADO" as const } };
  const [
    teamsByLeague,
    totalTeams,
    activeReferees,
    nextMatch,
    scheduled,
    pendingResult,
    played,
    cancelled,
    rescheduled,
    unscheduled,
    activeSanctionCount,
    rounds,
    upcomingNoRef,
    draft,
  ] = await Promise.all([
    prisma.team.groupBy({ by: ["leagueId"], where: { seasonId, active: true }, _count: true }),
    prisma.team.count({ where: { seasonId } }),
    prisma.referee.count({ where: { active: true } }),
    prisma.match.findFirst({ where: { ...notCancelled, date: { gte: today }, status: { in: ["PROGRAMADO", "REPROGRAMADO", "PENDIENTE"] } }, orderBy: { date: "asc" } }),
    prisma.match.count({ where: { seasonId, status: { in: ["PROGRAMADO", "REPROGRAMADO"] }, date: { gte: today } } }),
    prisma.match.findMany({
      where: { seasonId, status: { in: ["PROGRAMADO", "REPROGRAMADO"] }, date: { lt: today } },
      select: { date: true },
    }),
    prisma.match.count({ where: { seasonId, status: "JUGADO" } }),
    prisma.match.count({ where: { seasonId, status: "CANCELADO" } }),
    prisma.match.count({ where: { seasonId, status: "REPROGRAMADO" } }),
    prisma.match.count({ where: { seasonId, status: "PENDIENTE" } }),
    prisma.sanction.count({ where: { seasonId, status: { in: ["ACTIVA", "PENDIENTE", "EN_REVISION"] } } }),
    prisma.round.findMany({ where: { seasonId, phase: "REGULAR" }, orderBy: { number: "asc" } }),
    prisma.match.findMany({
      where: { seasonId, status: { in: ["PROGRAMADO", "REPROGRAMADO"] }, date: { gte: today }, refereeId: null },
      select: { id: true },
    }),
    prisma.scheduleDraft.findFirst({ where: { seasonId, status: "BORRADOR" } }),
  ]);

  const todayIso = todayISO();
  const currentRound =
    rounds.find((r) => toISODate(r.date)! >= todayIso) ?? rounds.at(-1) ?? null;
  const lastPlayedDate = (
    await prisma.match.aggregate({ where: { seasonId, status: "JUGADO" }, _max: { date: true } })
  )._max.date;

  const leagues = await Promise.all(
    season.leagues
      .filter((l) => l.active)
      .map(async (l) => {
        const [standings, scorers] = await Promise.all([getLeagueStandings(l.id), getLeagueScorers(l.id)]);
        return { league: l, standings, scorers: scorers.rows.slice(0, 3), activeTeams: teamsByLeague.find((t) => t.leagueId === l.id)?._count ?? 0 };
      }),
  );

  // ── Alertas ──
  const alerts: DashboardAlert[] = [];
  const pendingDates = [...new Set(pendingResult.map((m) => toISODate(m.date)!))].sort();
  if (pendingResult.length) {
    alerts.push({
      tone: "danger",
      text: `${pendingResult.length} partido(s) disputados sin resultado capturado (${pendingDates.map((d) => d.split("-").reverse().join("/")).join(", ")}).`,
      href: `/resultados?date=${pendingDates[0]}`,
    });
  }
  if (season.requireReferee && upcomingNoRef.length) {
    alerts.push({ tone: "warn", text: `${upcomingNoRef.length} partido(s) próximos sin árbitro asignado.`, href: "/partidos?sinArbitro=1" });
  }
  if (unscheduled) alerts.push({ tone: "warn", text: `${unscheduled} partido(s) pendientes de programar (sin fecha, horario o cancha).`, href: "/partidos?estado=PENDIENTE" });
  if (nextMatch?.date) {
    const iso = toISODate(nextMatch.date)!;
    const idle = await teamsWithoutMatch(seasonId, iso);
    const closed = new Set(
      (await prisma.standingSnapshot.findMany({ where: { kind: "CIERRE_FASE_REGULAR", league: { seasonId } }, select: { leagueId: true } })).map((x) => x.leagueId),
    );
    if (idle.length) {
      const allClosed = idle.every((t) => closed.has(t.leagueId));
      alerts.push({
        tone: allClosed ? "info" : "warn",
        text: allClosed
          ? `${idle.length} equipo(s) sin partido el ${iso.split("-").reverse().join("/")}: pueden jugar amistosos (no cuentan; la fase regular ya terminó).`
          : `${idle.length} equipo(s) sin partido el ${iso.split("-").reverse().join("/")} (${idle.map((t) => t.name).join(", ")}). Combínalos para que jueguen.`,
        href: `/partidos/completar?fecha=${iso}`,
      });
    }
  }
  if (draft) alerts.push({ tone: "info", text: "Hay un calendario provisional sin confirmar.", href: "/calendario" });

  // Árbitros asignados que registraron no estar disponibles
  const upcoming = await prisma.match.findMany({
    where: { seasonId, status: { in: ["PROGRAMADO", "REPROGRAMADO"] }, date: { gte: today }, refereeId: { not: null } },
    select: { id: true, date: true, timeSlotId: true, refereeId: true, homeTeam: { select: { name: true, active: true } }, awayTeam: { select: { name: true, active: true } } },
  });
  if (upcoming.length) {
    const avail = await prisma.refereeAvailability.findMany({ where: { date: { in: [...new Set(upcoming.map((m) => m.date!.getTime()))].map((t) => new Date(t)) } } });
    const conflictRefs = upcoming.filter(
      (m) =>
        m.timeSlotId &&
        !isRefereeAvailable(
          avail.map((a) => ({ refereeId: a.refereeId, date: toISODate(a.date)!, timeSlotId: a.timeSlotId, available: a.available })),
          m.refereeId!,
          toISODate(m.date)!,
          m.timeSlotId,
        ),
    );
    if (conflictRefs.length) {
      alerts.push({ tone: "danger", text: `${conflictRefs.length} partido(s) tienen un árbitro que registró no estar disponible.`, href: "/partidos?conflictos=1" });
    }
    const inactive = upcoming.filter((m) => !m.homeTeam.active || !m.awayTeam.active);
    if (inactive.length) {
      alerts.push({ tone: "warn", text: `${inactive.length} partido(s) próximos involucran equipos dados de baja.`, href: "/partidos?conflictos=1" });
    }
  }
  for (const l of leagues) {
    if (l.standings.unresolvedGroups.length) {
      alerts.push({ tone: "info", text: `${l.league.name}: hay equipos empatados que los criterios configurados no separan.`, href: `/tabla?liga=${l.league.id}` });
    }
  }
  if (rounds.length === 0) alerts.push({ tone: "info", text: "Aún no hay calendario. Genera la programación de las jornadas.", href: "/calendario" });

  return {
    season,
    totals: {
      teams: totalTeams,
      activeReferees,
      scheduled,
      pendingResult: pendingResult.length,
      played,
      cancelled,
      rescheduled,
      unscheduled,
      activeSanctions: activeSanctionCount,
    },
    nextDate: toISODate(nextMatch?.date ?? null),
    currentRound: currentRound ? { number: currentRound.number, date: toISODate(currentRound.date)! } : null,
    lastPlayedDate: toISODate(lastPlayedDate),
    leagues,
    alerts,
  };
}
