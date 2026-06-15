-- CreateEnum
CREATE TYPE "ScanRunType" AS ENUM ('FULL_SCAN', 'FOCUS_UPDATE', 'MODEL_REVIEW', 'VISUAL_REVIEW');

-- CreateEnum
CREATE TYPE "ScanRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ScanRun" (
  "id" TEXT NOT NULL,
  "type" "ScanRunType" NOT NULL,
  "status" "ScanRunStatus" NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "stockCount" INTEGER,
  "candidateCount" INTEGER,
  "focusListCount" INTEGER,
  "modelInputTokens" INTEGER,
  "modelOutputTokens" INTEGER,
  "modelCostEstimate" DECIMAL(12,6),
  "stepTimingsJson" JSONB,
  "error" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScanRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScanRun_type_startedAt_idx" ON "ScanRun"("type", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "ScanRun_status_idx" ON "ScanRun"("status");
