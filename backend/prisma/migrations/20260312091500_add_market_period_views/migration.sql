-- CreateEnum
CREATE TYPE "MarketPeriodGranularity" AS ENUM ('REGIME', 'MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "LeaderPeriodActivity" AS ENUM (
  'ADVANCING',
  'SETTING_UP',
  'PULLBACK',
  'REVERSAL',
  'BASING',
  'DECLINING',
  'QUIET'
);

-- AlterTable
ALTER TABLE "MarketRegimePeriod"
ADD COLUMN "granularity" "MarketPeriodGranularity" NOT NULL DEFAULT 'REGIME',
ADD COLUMN "periodKey" TEXT,
ADD COLUMN "sourcePeriodCount" INTEGER NOT NULL DEFAULT 1;

-- Backfill unique keys for existing rows before enforcing NOT NULL + unique constraint.
UPDATE "MarketRegimePeriod"
SET "periodKey" = "id"
WHERE "periodKey" IS NULL;

ALTER TABLE "MarketRegimePeriod"
ALTER COLUMN "periodKey" SET NOT NULL;

-- CreateTable
CREATE TABLE "MarketLeaderPeriodSnapshot" (
  "id" TEXT NOT NULL,
  "marketRegimePeriodId" TEXT NOT NULL,
  "leaderRunId" TEXT NOT NULL,
  "stockId" TEXT NOT NULL,
  "periodStartDate" DATE NOT NULL,
  "periodEndDate" DATE NOT NULL,
  "stageAtPeriodStart" "StageEnum",
  "stageAtPeriodEnd" "StageEnum",
  "activity" "LeaderPeriodActivity" NOT NULL,
  "activityNote" TEXT,
  "identifiedSetupLabel" TEXT,
  "primarySetupType" "SetupType",
  "primarySetupDirection" "Direction",
  "primarySetupState" "SetupState",
  "setupCount" INTEGER NOT NULL DEFAULT 0,
  "activeSetups" JSONB NOT NULL,
  "timingSignalCount" INTEGER NOT NULL DEFAULT 0,
  "timingSignals" JSONB NOT NULL,
  "startClose" DECIMAL(12,4),
  "endClose" DECIMAL(12,4),
  "periodReturnPct" DECIMAL(8,2),
  "shortingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketLeaderPeriodSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketRegimePeriod_granularity_periodKey_key"
ON "MarketRegimePeriod"("granularity", "periodKey");

-- CreateIndex
CREATE INDEX "MarketRegimePeriod_granularity_startDate_idx"
ON "MarketRegimePeriod"("granularity", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "MarketLeaderPeriodSnapshot_marketRegimePeriodId_leaderRunId_key"
ON "MarketLeaderPeriodSnapshot"("marketRegimePeriodId", "leaderRunId");

-- CreateIndex
CREATE INDEX "MarketLeaderPeriodSnapshot_stockId_periodStartDate_idx"
ON "MarketLeaderPeriodSnapshot"("stockId", "periodStartDate");

-- CreateIndex
CREATE INDEX "MarketLeaderPeriodSnapshot_activity_periodStartDate_idx"
ON "MarketLeaderPeriodSnapshot"("activity", "periodStartDate");

-- AddForeignKey
ALTER TABLE "MarketLeaderPeriodSnapshot"
ADD CONSTRAINT "MarketLeaderPeriodSnapshot_marketRegimePeriodId_fkey"
FOREIGN KEY ("marketRegimePeriodId") REFERENCES "MarketRegimePeriod"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketLeaderPeriodSnapshot"
ADD CONSTRAINT "MarketLeaderPeriodSnapshot_leaderRunId_fkey"
FOREIGN KEY ("leaderRunId") REFERENCES "LeaderRun"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketLeaderPeriodSnapshot"
ADD CONSTRAINT "MarketLeaderPeriodSnapshot_stockId_fkey"
FOREIGN KEY ("stockId") REFERENCES "Stock"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
