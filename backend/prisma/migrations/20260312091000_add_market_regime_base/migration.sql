-- CreateEnum
CREATE TYPE "SetupFamily" AS ENUM ('REVERSAL', 'TREND_LONG', 'TREND_SHORT');

-- CreateEnum
CREATE TYPE "SetupOutcomeSource" AS ENUM ('LIVE', 'SIMULATED');

-- CreateEnum
CREATE TYPE "MarketTrendLabel" AS ENUM ('UPTREND', 'DOWNTREND', 'RANGE', 'TRANSITION');

-- CreateEnum
CREATE TYPE "MarketRegimeLabel" AS ENUM ('TREND_UP', 'TREND_DOWN', 'RANGE', 'TRANSITION');

-- CreateEnum
CREATE TYPE "TimingSignalType" AS ENUM (
  'CROSS_620',
  'MACD_620_SHORT',
  'VCP_EARLY_BUY',
  'DOUBLE_TOP_REJECTION',
  'DOUBLE_BOTTOM_REJECTION'
);

-- CreateTable
CREATE TABLE "LeaderRun" (
  "id" TEXT NOT NULL,
  "stockId" TEXT NOT NULL,
  "stage2StartDate" DATE NOT NULL,
  "stage2EndDate" DATE NOT NULL,
  "entryPrice" DECIMAL(12,4) NOT NULL,
  "peakPrice" DECIMAL(12,4) NOT NULL,
  "peakGainPct" DECIMAL(8,2) NOT NULL,
  "isQualified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaderRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetupOutcome" (
  "id" TEXT NOT NULL,
  "setupId" TEXT,
  "stockId" TEXT,
  "source" "SetupOutcomeSource" NOT NULL,
  "family" "SetupFamily" NOT NULL,
  "setupType" "SetupType" NOT NULL,
  "direction" "Direction" NOT NULL,
  "effectiveDate" DATE NOT NULL,
  "detectedAt" TIMESTAMP(3) NOT NULL,
  "entryDate" TIMESTAMP(3),
  "exitDate" TIMESTAMP(3),
  "actualStopPrice" DECIMAL(12,4),
  "entryPrice" DECIMAL(12,4),
  "exitPrice" DECIMAL(12,4),
  "maxR" DECIMAL(8,2),
  "finalR" DECIMAL(8,2),
  "isWin" BOOLEAN,
  "sampleCount" INTEGER NOT NULL DEFAULT 1,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SetupOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntradayTimingSignal" (
  "id" TEXT NOT NULL,
  "parentSetupId" TEXT NOT NULL,
  "stockId" TEXT NOT NULL,
  "type" "TimingSignalType" NOT NULL,
  "direction" "Direction" NOT NULL,
  "signalAt" TIMESTAMP(3) NOT NULL,
  "levelType" "KeyLevelType" NOT NULL,
  "referenceLevel" DECIMAL(12,4) NOT NULL,
  "triggerPrice" DECIMAL(12,4),
  "stopPrice" DECIMAL(12,4),
  "evidence" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntradayTimingSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketProxySnapshot" (
  "id" TEXT NOT NULL,
  "indexId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "close" DECIMAL(12,4) NOT NULL,
  "sma50" DECIMAL(12,4),
  "sma200" DECIMAL(12,4),
  "stage" "StageEnum" NOT NULL,
  "trend" "MarketTrendLabel" NOT NULL,
  "dominantFamily" "SetupFamily",
  "dominantSetup" "SetupType",
  "setupScore" DECIMAL(8,2),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketProxySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketRegimePeriod" (
  "id" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "label" "MarketRegimeLabel" NOT NULL,
  "liveSampleCount" INTEGER NOT NULL DEFAULT 0,
  "simulatedSampleCount" INTEGER NOT NULL DEFAULT 0,
  "scorecard" JSONB NOT NULL,
  "proxyStates" JSONB NOT NULL,
  "leaderSummary" JSONB NOT NULL,
  "markdown" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketRegimePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaderRun_stockId_stage2StartDate_idx" ON "LeaderRun"("stockId", "stage2StartDate");
CREATE INDEX "LeaderRun_isQualified_stage2StartDate_idx" ON "LeaderRun"("isQualified", "stage2StartDate");

CREATE INDEX "SetupOutcome_effectiveDate_source_family_idx" ON "SetupOutcome"("effectiveDate", "source", "family");
CREATE INDEX "SetupOutcome_stockId_effectiveDate_idx" ON "SetupOutcome"("stockId", "effectiveDate");
CREATE INDEX "SetupOutcome_setupId_idx" ON "SetupOutcome"("setupId");

CREATE INDEX "IntradayTimingSignal_parentSetupId_signalAt_idx" ON "IntradayTimingSignal"("parentSetupId", "signalAt");
CREATE INDEX "IntradayTimingSignal_stockId_signalAt_idx" ON "IntradayTimingSignal"("stockId", "signalAt");

CREATE UNIQUE INDEX "MarketProxySnapshot_indexId_date_key" ON "MarketProxySnapshot"("indexId", "date");
CREATE INDEX "MarketProxySnapshot_date_trend_idx" ON "MarketProxySnapshot"("date", "trend");

CREATE INDEX "MarketRegimePeriod_startDate_endDate_idx" ON "MarketRegimePeriod"("startDate", "endDate");
CREATE INDEX "MarketRegimePeriod_label_startDate_idx" ON "MarketRegimePeriod"("label", "startDate");

-- AddForeignKey
ALTER TABLE "LeaderRun"
ADD CONSTRAINT "LeaderRun_stockId_fkey"
FOREIGN KEY ("stockId") REFERENCES "Stock"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SetupOutcome"
ADD CONSTRAINT "SetupOutcome_setupId_fkey"
FOREIGN KEY ("setupId") REFERENCES "Setup"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SetupOutcome"
ADD CONSTRAINT "SetupOutcome_stockId_fkey"
FOREIGN KEY ("stockId") REFERENCES "Stock"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IntradayTimingSignal"
ADD CONSTRAINT "IntradayTimingSignal_parentSetupId_fkey"
FOREIGN KEY ("parentSetupId") REFERENCES "Setup"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IntradayTimingSignal"
ADD CONSTRAINT "IntradayTimingSignal_stockId_fkey"
FOREIGN KEY ("stockId") REFERENCES "Stock"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketProxySnapshot"
ADD CONSTRAINT "MarketProxySnapshot_indexId_fkey"
FOREIGN KEY ("indexId") REFERENCES "IndexEntity"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
