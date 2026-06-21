-- CreateEnum
CREATE TYPE "SetupScanAuditStatus" AS ENUM ('INPUT_FILTERED', 'CANDIDATE', 'INSUFFICIENT_DATA', 'NO_SETUP', 'DETECTED', 'DEDUPED', 'SUPPRESSED', 'ERROR');

-- CreateEnum
CREATE TYPE "SetupScanFocusStatus" AS ENUM ('NOT_EVALUATED', 'INCLUDED', 'EXCLUDED');

-- AlterTable
ALTER TABLE "ModelReview" ADD COLUMN "prompt" TEXT,
ADD COLUMN "payloadJson" JSONB;

-- CreateTable
CREATE TABLE "SetupScanAuditRun" (
    "id" TEXT NOT NULL,
    "scanRunId" TEXT,
    "status" "ScanRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "stockCount" INTEGER NOT NULL DEFAULT 0,
    "inputCount" INTEGER NOT NULL DEFAULT 0,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "detectedCount" INTEGER NOT NULL DEFAULT 0,
    "focusIncludedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetupScanAuditRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetupScanAuditItem" (
    "id" TEXT NOT NULL,
    "auditRunId" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT,
    "sector" TEXT,
    "industry" TEXT,
    "stage" "StageEnum",
    "category" "StockCategory",
    "latestClose" DECIMAL(12,4),
    "avgVolume" BIGINT,
    "scanStatus" "SetupScanAuditStatus" NOT NULL,
    "focusStatus" "SetupScanFocusStatus" NOT NULL DEFAULT 'NOT_EVALUATED',
    "reasonCodesJson" JSONB NOT NULL,
    "reasonText" TEXT,
    "setupTypesText" TEXT,
    "detectedSetupsJson" JSONB,
    "modelReviewIdsJson" JSONB,
    "focusReason" "FocusReason",
    "setupBias" "SetupBias",
    "priorityScore" DECIMAL(6,2),
    "identifiedSetupJson" JSONB,
    "error" TEXT,
    "scannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetupScanAuditItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SetupScanAuditRun_startedAt_idx" ON "SetupScanAuditRun"("startedAt" DESC);

-- CreateIndex
CREATE INDEX "SetupScanAuditRun_scanRunId_idx" ON "SetupScanAuditRun"("scanRunId");

-- CreateIndex
CREATE INDEX "SetupScanAuditRun_status_idx" ON "SetupScanAuditRun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SetupScanAuditItem_auditRunId_stockId_key" ON "SetupScanAuditItem"("auditRunId", "stockId");

-- CreateIndex
CREATE INDEX "SetupScanAuditItem_auditRunId_scanStatus_idx" ON "SetupScanAuditItem"("auditRunId", "scanStatus");

-- CreateIndex
CREATE INDEX "SetupScanAuditItem_auditRunId_focusStatus_idx" ON "SetupScanAuditItem"("auditRunId", "focusStatus");

-- CreateIndex
CREATE INDEX "SetupScanAuditItem_ticker_idx" ON "SetupScanAuditItem"("ticker");

-- CreateIndex
CREATE INDEX "SetupScanAuditItem_setupTypesText_idx" ON "SetupScanAuditItem"("setupTypesText");

-- CreateIndex
CREATE INDEX "SetupScanAuditItem_stockId_idx" ON "SetupScanAuditItem"("stockId");

-- AddForeignKey
ALTER TABLE "SetupScanAuditRun" ADD CONSTRAINT "SetupScanAuditRun_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "ScanRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupScanAuditItem" ADD CONSTRAINT "SetupScanAuditItem_auditRunId_fkey" FOREIGN KEY ("auditRunId") REFERENCES "SetupScanAuditRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupScanAuditItem" ADD CONSTRAINT "SetupScanAuditItem_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
