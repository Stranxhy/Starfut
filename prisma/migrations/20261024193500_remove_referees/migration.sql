-- Eliminación del módulo de árbitros (solicitado por la liga).
-- Respaldo previo: backups/starfutbol_2026-10-24_19-31.dump

-- Índice parcial creado en la migración inicial (un árbitro por horario)
DROP INDEX IF EXISTS "Match_referee_slot_active_key";

-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_refereeId_fkey";

-- DropForeignKey
ALTER TABLE "RefereeAvailability" DROP CONSTRAINT "RefereeAvailability_refereeId_fkey";

-- DropForeignKey
ALTER TABLE "RefereeAvailability" DROP CONSTRAINT "RefereeAvailability_timeSlotId_fkey";

-- DropIndex
DROP INDEX "Match_refereeId_date_idx";

-- AlterTable
ALTER TABLE "Match" DROP COLUMN "refereeId";

-- AlterTable
ALTER TABLE "Season" DROP COLUMN "requireReferee";

-- DropTable
DROP TABLE "Referee";

-- DropTable
DROP TABLE "RefereeAvailability";

