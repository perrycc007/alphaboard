-- CreateEnum
CREATE TYPE "FocusListType" AS ENUM ('WEEKLY', 'MIDWEEK', 'THEME', 'MANUAL');

-- CreateEnum
CREATE TYPE "SetupBias" AS ENUM ('LONG', 'SHORT', 'BOTH', 'WATCH');

-- CreateEnum
CREATE TYPE "FocusListItemStatus" AS ENUM ('ACTIVE', 'TRIGGERED', 'VIOLATED', 'EXPIRED', 'REMOVED');

-- CreateEnum
CREATE TYPE "FocusReason" AS ENUM (
  'STRONG_DAILY_SETUP',
  'GROUP_SYNCHRONIZED',
  'CATALYST_HYPOTHESIS',
  'CURRENT_LEADER',
  'PREVIOUS_LEADER_KEY_LEVEL',
  'REVERSAL_620_ZONE',
  'MANUAL_PIN'
);

-- CreateTable
CREATE TABLE "FocusList" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "FocusListType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "sourceScanRunId" TEXT,
  "marketConditionSnapshotId" TEXT,
  "notes" TEXT,
  CONSTRAINT "FocusList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusListItem" (
  "id" TEXT NOT NULL,
  "focusListId" TEXT NOT NULL,
  "stockId" TEXT NOT NULL,
  "themeId" TEXT,
  "groupId" TEXT,
  "reason" "FocusReason" NOT NULL,
  "priorityScore" DECIMAL(6,2),
  "setupBias" "SetupBias" NOT NULL DEFAULT 'WATCH',
  "expectedSetupTypesJson" JSONB,
  "keyLevelsJson" JSONB,
  "invalidationLevelsJson" JSONB,
  "catalystHypothesisId" TEXT,
  "focusToday" BOOLEAN NOT NULL DEFAULT false,
  "focusTodayReason" TEXT,
  "status" "FocusListItemStatus" NOT NULL DEFAULT 'ACTIVE',
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReviewedAt" TIMESTAMP(3),
  CONSTRAINT "FocusListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FocusList_type_createdAt_idx" ON "FocusList"("type", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "FocusListItem_focusListId_stockId_key" ON "FocusListItem"("focusListId", "stockId");

-- CreateIndex
CREATE INDEX "FocusListItem_status_idx" ON "FocusListItem"("status");

-- CreateIndex
CREATE INDEX "FocusListItem_focusToday_idx" ON "FocusListItem"("focusToday");

-- AddForeignKey
ALTER TABLE "FocusList" ADD CONSTRAINT "FocusList_sourceScanRunId_fkey" FOREIGN KEY ("sourceScanRunId") REFERENCES "ScanRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusListItem" ADD CONSTRAINT "FocusListItem_focusListId_fkey" FOREIGN KEY ("focusListId") REFERENCES "FocusList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusListItem" ADD CONSTRAINT "FocusListItem_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusListItem" ADD CONSTRAINT "FocusListItem_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusListItem" ADD CONSTRAINT "FocusListItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SupplyChainGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
