-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'AUXILIAR', 'ARBITRO', 'CONSULTA');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('CONFIGURACION', 'EN_CURSO', 'FASE_REGULAR_CERRADA', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "RoundPhase" AS ENUM ('REGULAR', 'ELIMINATORIA');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDIENTE', 'PROGRAMADO', 'JUGADO', 'CANCELADO', 'REPROGRAMADO');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('OFICIAL', 'SUSTITUCION', 'AMISTOSO', 'INTERLIGA', 'ELIMINATORIA');

-- CreateEnum
CREATE TYPE "ResultType" AS ENUM ('TIEMPO_REGULAR', 'DESEMPATE', 'EMPATE', 'ADMINISTRATIVO');

-- CreateEnum
CREATE TYPE "SanctionUnitKind" AS ENUM ('PARTIDOS', 'MINUTOS', 'DIAS', 'OTRA');

-- CreateEnum
CREATE TYPE "SanctionStatus" AS ENUM ('ACTIVA', 'PENDIENTE', 'CUMPLIDA', 'CANCELADA', 'EN_REVISION');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('BORRADOR', 'CONFIRMADO', 'DESCARTADO');

-- CreateEnum
CREATE TYPE "PlayoffStageStatus" AS ENUM ('PENDIENTE', 'GENERADA', 'COMPLETADA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modality" TEXT NOT NULL DEFAULT 'Futbol 7',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Field" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'CONFIGURACION',
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "startDate" DATE NOT NULL,
    "weekday" INTEGER NOT NULL DEFAULT 0,
    "regularRounds" INTEGER NOT NULL DEFAULT 14,
    "requireReferee" BOOLEAN NOT NULL DEFAULT true,
    "allowInterLeague" BOOLEAN NOT NULL DEFAULT false,
    "excludedDates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeSlot" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 50,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldBlock" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "timeSlotId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "championTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringConfig" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "leagueId" TEXT,
    "winPoints" INTEGER NOT NULL DEFAULT 3,
    "lossPoints" INTEGER NOT NULL DEFAULT 0,
    "shootoutWinPoints" INTEGER NOT NULL DEFAULT 2,
    "shootoutLossPoints" INTEGER NOT NULL DEFAULT 1,
    "allowDraws" BOOLEAN NOT NULL DEFAULT false,
    "drawPoints" INTEGER,

    CONSTRAINT "ScoringConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TiebreakConfig" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "leagueId" TEXT,
    "criteria" TEXT[],
    "scorerCriteria" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "TiebreakConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "logo" BYTEA,
    "logoMime" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamRestriction" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "date" DATE,
    "timeSlotId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "jerseyNumber" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerTeamHistory" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toDate" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "PlayerTeamHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefereeAvailability" (
    "id" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "timeSlotId" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefereeAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "phase" "RoundPhase" NOT NULL DEFAULT 'REGULAR',
    "number" INTEGER NOT NULL,
    "name" TEXT,
    "date" DATE NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "leagueId" TEXT,
    "roundId" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'REGULAR',
    "type" "MatchType" NOT NULL DEFAULT 'OFICIAL',
    "countsForStandings" BOOLEAN NOT NULL DEFAULT true,
    "status" "MatchStatus" NOT NULL DEFAULT 'PROGRAMADO',
    "date" DATE,
    "timeSlotId" TEXT,
    "fieldId" TEXT,
    "refereeId" TEXT,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "replacesMatchId" TEXT,
    "originalDate" DATE,
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "cancelReason" TEXT,
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchResult" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "resultType" "ResultType" NOT NULL,
    "homeGoals" INTEGER NOT NULL,
    "awayGoals" INTEGER NOT NULL,
    "homeShootout" INTEGER,
    "awayShootout" INTEGER,
    "winnerTeamId" TEXT,
    "notes" TEXT,
    "recordedById" TEXT,
    "updatedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchScorer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "goals" INTEGER NOT NULL,

    CONSTRAINT "MatchScorer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SanctionType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SanctionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SanctionUnit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SanctionUnitKind" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SanctionUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sanction" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "matchId" TEXT,
    "date" DATE NOT NULL,
    "typeId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "unitId" TEXT NOT NULL,
    "status" "SanctionStatus" NOT NULL DEFAULT 'ACTIVA',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sanction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SanctionServing" (
    "id" TEXT NOT NULL,
    "sanctionId" TEXT NOT NULL,
    "matchId" TEXT,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SanctionServing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleDraft" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'BORRADOR',
    "params" JSONB NOT NULL,
    "data" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayoffFormat" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "stages" JSONB NOT NULL,
    "zones" JSONB NOT NULL,
    "officialConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayoffFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandingSnapshot" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CIERRE_FASE_REGULAR',
    "rows" JSONB NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StandingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayoffStage" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "PlayoffStageStatus" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayoffStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayoffTie" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "homeSource" TEXT NOT NULL,
    "awaySource" TEXT NOT NULL,
    "homeTeamId" TEXT,
    "awayTeamId" TEXT,
    "matchId" TEXT,
    "winnerTeamId" TEXT,

    CONSTRAINT "PlayoffTie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Venue_tournamentId_name_key" ON "Venue"("tournamentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Field_venueId_name_key" ON "Field"("venueId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Season_tournamentId_name_key" ON "Season"("tournamentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TimeSlot_seasonId_startTime_key" ON "TimeSlot"("seasonId", "startTime");

-- CreateIndex
CREATE INDEX "FieldBlock_date_idx" ON "FieldBlock"("date");

-- CreateIndex
CREATE UNIQUE INDEX "League_seasonId_name_key" ON "League"("seasonId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringConfig_leagueId_key" ON "ScoringConfig"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "TiebreakConfig_leagueId_key" ON "TiebreakConfig"("leagueId");

-- CreateIndex
CREATE INDEX "Team_seasonId_idx" ON "Team"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_leagueId_nameKey_key" ON "Team"("leagueId", "nameKey");

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE INDEX "Player_seasonId_idx" ON "Player"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "Referee_nameKey_key" ON "Referee"("nameKey");

-- CreateIndex
CREATE INDEX "RefereeAvailability_date_idx" ON "RefereeAvailability"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Round_seasonId_phase_number_key" ON "Round"("seasonId", "phase", "number");

-- CreateIndex
CREATE INDEX "Match_seasonId_date_idx" ON "Match"("seasonId", "date");

-- CreateIndex
CREATE INDEX "Match_leagueId_idx" ON "Match"("leagueId");

-- CreateIndex
CREATE INDEX "Match_homeTeamId_idx" ON "Match"("homeTeamId");

-- CreateIndex
CREATE INDEX "Match_awayTeamId_idx" ON "Match"("awayTeamId");

-- CreateIndex
CREATE INDEX "Match_refereeId_date_idx" ON "Match"("refereeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MatchResult_matchId_key" ON "MatchResult"("matchId");

-- CreateIndex
CREATE INDEX "MatchScorer_playerId_idx" ON "MatchScorer"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchScorer_matchId_playerId_key" ON "MatchScorer"("matchId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "SanctionType_name_key" ON "SanctionType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SanctionUnit_name_key" ON "SanctionUnit"("name");

-- CreateIndex
CREATE INDEX "Sanction_seasonId_idx" ON "Sanction"("seasonId");

-- CreateIndex
CREATE INDEX "Sanction_playerId_idx" ON "Sanction"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "SanctionServing_sanctionId_matchId_key" ON "SanctionServing"("sanctionId", "matchId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayoffFormat_leagueId_key" ON "PlayoffFormat"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "StandingSnapshot_leagueId_kind_key" ON "StandingSnapshot"("leagueId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "PlayoffStage_leagueId_code_key" ON "PlayoffStage"("leagueId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PlayoffTie_matchId_key" ON "PlayoffTie"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayoffTie_stageId_slot_key" ON "PlayoffTie"("stageId", "slot");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Field" ADD CONSTRAINT "Field_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeSlot" ADD CONSTRAINT "TimeSlot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldBlock" ADD CONSTRAINT "FieldBlock_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldBlock" ADD CONSTRAINT "FieldBlock_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_championTeamId_fkey" FOREIGN KEY ("championTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringConfig" ADD CONSTRAINT "ScoringConfig_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringConfig" ADD CONSTRAINT "ScoringConfig_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TiebreakConfig" ADD CONSTRAINT "TiebreakConfig_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TiebreakConfig" ADD CONSTRAINT "TiebreakConfig_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRestriction" ADD CONSTRAINT "TeamRestriction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRestriction" ADD CONSTRAINT "TeamRestriction_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerTeamHistory" ADD CONSTRAINT "PlayerTeamHistory_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerTeamHistory" ADD CONSTRAINT "PlayerTeamHistory_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefereeAvailability" ADD CONSTRAINT "RefereeAvailability_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "Referee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefereeAvailability" ADD CONSTRAINT "RefereeAvailability_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "Referee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_replacesMatchId_fkey" FOREIGN KEY ("replacesMatchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchScorer" ADD CONSTRAINT "MatchScorer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchScorer" ADD CONSTRAINT "MatchScorer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchScorer" ADD CONSTRAINT "MatchScorer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sanction" ADD CONSTRAINT "Sanction_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sanction" ADD CONSTRAINT "Sanction_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sanction" ADD CONSTRAINT "Sanction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sanction" ADD CONSTRAINT "Sanction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sanction" ADD CONSTRAINT "Sanction_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "SanctionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sanction" ADD CONSTRAINT "Sanction_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "SanctionUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SanctionServing" ADD CONSTRAINT "SanctionServing_sanctionId_fkey" FOREIGN KEY ("sanctionId") REFERENCES "Sanction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SanctionServing" ADD CONSTRAINT "SanctionServing_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleDraft" ADD CONSTRAINT "ScheduleDraft_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffFormat" ADD CONSTRAINT "PlayoffFormat_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffFormat" ADD CONSTRAINT "PlayoffFormat_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingSnapshot" ADD CONSTRAINT "StandingSnapshot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingSnapshot" ADD CONSTRAINT "StandingSnapshot_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffStage" ADD CONSTRAINT "PlayoffStage_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffStage" ADD CONSTRAINT "PlayoffStage_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffTie" ADD CONSTRAINT "PlayoffTie_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PlayoffStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffTie" ADD CONSTRAINT "PlayoffTie_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffTie" ADD CONSTRAINT "PlayoffTie_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffTie" ADD CONSTRAINT "PlayoffTie_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffTie" ADD CONSTRAINT "PlayoffTie_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ───────── Restricciones adicionales (índices parciales) ─────────
-- Una cancha no puede tener dos partidos activos en la misma fecha y horario.
CREATE UNIQUE INDEX "Match_field_slot_active_key" ON "Match" ("date", "timeSlotId", "fieldId")
  WHERE "status" NOT IN ('CANCELADO') AND "date" IS NOT NULL AND "timeSlotId" IS NOT NULL AND "fieldId" IS NOT NULL;
-- Un árbitro no puede tener dos partidos activos simultáneos.
CREATE UNIQUE INDEX "Match_referee_slot_active_key" ON "Match" ("date", "timeSlotId", "refereeId")
  WHERE "status" NOT IN ('CANCELADO') AND "date" IS NOT NULL AND "timeSlotId" IS NOT NULL AND "refereeId" IS NOT NULL;
-- Un partido no puede enfrentar a un equipo consigo mismo.
ALTER TABLE "Match" ADD CONSTRAINT "Match_distinct_teams_check" CHECK ("homeTeamId" <> "awayTeamId");
-- Marcadores no negativos.
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_goals_check" CHECK ("homeGoals" >= 0 AND "awayGoals" >= 0 AND COALESCE("homeShootout",0) >= 0 AND COALESCE("awayShootout",0) >= 0);
ALTER TABLE "MatchScorer" ADD CONSTRAINT "MatchScorer_goals_check" CHECK ("goals" > 0);
ALTER TABLE "Sanction" ADD CONSTRAINT "Sanction_duration_check" CHECK ("duration" >= 0);
-- Una sola temporada vigente.
CREATE UNIQUE INDEX "Season_single_current_key" ON "Season" ("isCurrent") WHERE "isCurrent" = true;
-- Una sola configuración general (sin liga) por temporada.
CREATE UNIQUE INDEX "ScoringConfig_season_default_key" ON "ScoringConfig" ("seasonId") WHERE "leagueId" IS NULL;
CREATE UNIQUE INDEX "TiebreakConfig_season_default_key" ON "TiebreakConfig" ("seasonId") WHERE "leagueId" IS NULL;
