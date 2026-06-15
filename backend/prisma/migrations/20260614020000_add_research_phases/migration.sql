-- CreateEnum
CREATE TYPE "TradableType" AS ENUM ('STOCK', 'ETF', 'INDEX', 'COMMODITY_PROXY');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('LEADS', 'LAGS', 'BENEFITS', 'HURTS', 'COMPETES', 'SUPPLIER_TO');

-- CreateEnum
CREATE TYPE "MacroSensitivity" AS ENUM ('RATES', 'DOLLAR', 'OIL', 'COPPER', 'GOLD', 'YIELDS', 'INFLATION');

-- CreateEnum
CREATE TYPE "CatalystStatus" AS ENUM ('WATCHING', 'CONFIRMED', 'REJECTED', 'STALE');

-- CreateEnum
CREATE TYPE "MarketScopeType" AS ENUM ('INDEX', 'LEADER_UNIVERSE', 'TRADABLE_UNIVERSE', 'THEME', 'GROUP');

-- CreateEnum
CREATE TYPE "ModelReviewType" AS ENUM (
  'DATAFRAME_REVIEW',
  'METADATA_ENRICHMENT',
  'CATALYST_SEARCH',
  'GROUP_GALLERY',
  'CHART_REVIEW',
  'STRATEGY_REPORT'
);

-- CreateEnum
CREATE TYPE "ExposureMode" AS ENUM ('STAY_OUT', 'WATER_TEST', 'NORMAL', 'AGGRESSIVE', 'MARGIN_ALLOWED');

-- AlterTable
ALTER TABLE "Stock"
  ADD COLUMN "briefDescription" TEXT,
  ADD COLUMN "tradableType" "TradableType",
  ADD COLUMN "isTradable" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "TickerThemeMembership" (
  "id" TEXT NOT NULL,
  "stockId" TEXT NOT NULL,
  "themeId" TEXT NOT NULL,
  "groupId" TEXT,
  "roleDescription" TEXT,
  "importanceScore" DECIMAL(4,3),
  "isPrimaryTheme" BOOLEAN NOT NULL DEFAULT false,
  "source" TEXT,
  "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TickerThemeMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupRelationship" (
  "id" TEXT NOT NULL,
  "sourceGroupId" TEXT NOT NULL,
  "targetGroupId" TEXT NOT NULL,
  "relationshipType" "RelationshipType" NOT NULL,
  "macroSensitivity" "MacroSensitivity",
  "strengthScore" DECIMAL(4,3),
  "lagDaysEstimate" INTEGER,
  "source" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalystHypothesis" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "themeId" TEXT,
  "groupId" TEXT,
  "title" TEXT NOT NULL,
  "hypothesis" TEXT NOT NULL,
  "sourceUrlsJson" JSONB,
  "expectedBeneficiariesJson" JSONB,
  "expectedLosersJson" JSONB,
  "technicalVerificationJson" JSONB,
  "status" "CatalystStatus" NOT NULL DEFAULT 'WATCHING',
  "confidenceScore" DECIMAL(4,3),
  CONSTRAINT "CatalystHypothesis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketConditionSnapshot" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "scopeType" "MarketScopeType" NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "longTermTrendingUp" BOOLEAN NOT NULL DEFAULT false,
  "longTermTrendingDown" BOOLEAN NOT NULL DEFAULT false,
  "longTermRanging" BOOLEAN NOT NULL DEFAULT false,
  "longTermRangeHigh" DECIMAL(12,4),
  "longTermRangeLow" DECIMAL(12,4),
  "midTermTrendingUp" BOOLEAN NOT NULL DEFAULT false,
  "midTermTrendingDown" BOOLEAN NOT NULL DEFAULT false,
  "midTermRanging" BOOLEAN NOT NULL DEFAULT false,
  "midTermExtended" BOOLEAN NOT NULL DEFAULT false,
  "midTermPullback" BOOLEAN NOT NULL DEFAULT false,
  "shortTermTrendingUp" BOOLEAN NOT NULL DEFAULT false,
  "shortTermTrendingDown" BOOLEAN NOT NULL DEFAULT false,
  "shortTermRanging" BOOLEAN NOT NULL DEFAULT false,
  "shortTermExtended" BOOLEAN NOT NULL DEFAULT false,
  "shortTermOversold" BOOLEAN NOT NULL DEFAULT false,
  "breadthConfirming" BOOLEAN NOT NULL DEFAULT false,
  "breadthDiverging" BOOLEAN NOT NULL DEFAULT false,
  "breadthImproving" BOOLEAN NOT NULL DEFAULT false,
  "breadthDeteriorating" BOOLEAN NOT NULL DEFAULT false,
  "leadersAdvancing" BOOLEAN NOT NULL DEFAULT false,
  "leadersBasing" BOOLEAN NOT NULL DEFAULT false,
  "leadersFailing" BOOLEAN NOT NULL DEFAULT false,
  "leadersExtended" BOOLEAN NOT NULL DEFAULT false,
  "leadersRotating" BOOLEAN NOT NULL DEFAULT false,
  "easyMoney" BOOLEAN NOT NULL DEFAULT false,
  "quickRotation" BOOLEAN NOT NULL DEFAULT false,
  "hardPenny" BOOLEAN NOT NULL DEFAULT false,
  "distribution" BOOLEAN NOT NULL DEFAULT false,
  "earlyRecovery" BOOLEAN NOT NULL DEFAULT false,
  "breakoutFavorable" BOOLEAN NOT NULL DEFAULT false,
  "pullbackFavorable" BOOLEAN NOT NULL DEFAULT false,
  "reversalFavorable" BOOLEAN NOT NULL DEFAULT false,
  "shortFavorable" BOOLEAN NOT NULL DEFAULT false,
  "holdLongerFavorable" BOOLEAN NOT NULL DEFAULT false,
  "scalpOnly" BOOLEAN NOT NULL DEFAULT false,
  "stayOut" BOOLEAN NOT NULL DEFAULT false,
  "waterTest" BOOLEAN NOT NULL DEFAULT false,
  "normalExposure" BOOLEAN NOT NULL DEFAULT false,
  "aggressiveExposure" BOOLEAN NOT NULL DEFAULT false,
  "marginAllowed" BOOLEAN NOT NULL DEFAULT false,
  "trendScore" DECIMAL(5,2),
  "breadthScore" DECIMAL(5,2),
  "leaderScore" DECIMAL(5,2),
  "followThroughScore" DECIMAL(5,2),
  "riskScore" DECIMAL(5,2),
  "confidenceScore" DECIMAL(5,2),
  "evidenceJson" JSONB,
  "summary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketConditionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelReview" (
  "id" TEXT NOT NULL,
  "scanRunId" TEXT,
  "reviewType" "ModelReviewType" NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "costEstimate" DECIMAL(12,6),
  "targetType" TEXT,
  "targetId" TEXT,
  "resultJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModelReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyRecommendation" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "stockId" TEXT NOT NULL,
  "themeId" TEXT,
  "groupId" TEXT,
  "setupType" "SetupType",
  "direction" "Direction" NOT NULL,
  "entryZoneJson" JSONB,
  "stopLevel" DECIMAL(12,4),
  "targetLevelsJson" JSONB,
  "exitPlanJson" JSONB,
  "thesis" TEXT,
  "catalystHypothesisId" TEXT,
  "marketConditionSnapshotId" TEXT,
  "confidenceScore" DECIMAL(5,2),
  "exposureMode" "ExposureMode" NOT NULL DEFAULT 'NORMAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StrategyRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationOutcome" (
  "id" TEXT NOT NULL,
  "recommendationId" TEXT NOT NULL,
  "maxR" DECIMAL(8,2),
  "maxPctMove" DECIMAL(8,2),
  "finalR" DECIMAL(8,2),
  "daysToMaxR" INTEGER,
  "stoppedOut" BOOLEAN NOT NULL DEFAULT false,
  "targetHit" BOOLEAN NOT NULL DEFAULT false,
  "setupViolated" BOOLEAN NOT NULL DEFAULT false,
  "bestExitSignal" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecommendationOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TickerThemeMembership_stockId_themeId_key" ON "TickerThemeMembership"("stockId", "themeId");

-- CreateIndex
CREATE INDEX "TickerThemeMembership_themeId_idx" ON "TickerThemeMembership"("themeId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupRelationship_sourceGroupId_targetGroupId_relationshipType_key" ON "GroupRelationship"("sourceGroupId", "targetGroupId", "relationshipType");

-- CreateIndex
CREATE INDEX "GroupRelationship_sourceGroupId_idx" ON "GroupRelationship"("sourceGroupId");

-- CreateIndex
CREATE INDEX "GroupRelationship_targetGroupId_idx" ON "GroupRelationship"("targetGroupId");

-- CreateIndex
CREATE INDEX "CatalystHypothesis_status_createdAt_idx" ON "CatalystHypothesis"("status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MarketConditionSnapshot_date_scopeType_scopeKey_key" ON "MarketConditionSnapshot"("date", "scopeType", "scopeKey");

-- CreateIndex
CREATE INDEX "MarketConditionSnapshot_scopeType_date_idx" ON "MarketConditionSnapshot"("scopeType", "date" DESC);

-- CreateIndex
CREATE INDEX "ModelReview_reviewType_createdAt_idx" ON "ModelReview"("reviewType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ModelReview_scanRunId_idx" ON "ModelReview"("scanRunId");

-- CreateIndex
CREATE INDEX "StrategyRecommendation_date_idx" ON "StrategyRecommendation"("date" DESC);

-- CreateIndex
CREATE INDEX "StrategyRecommendation_stockId_date_idx" ON "StrategyRecommendation"("stockId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationOutcome_recommendationId_key" ON "RecommendationOutcome"("recommendationId");

-- AddForeignKey
ALTER TABLE "TickerThemeMembership" ADD CONSTRAINT "TickerThemeMembership_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TickerThemeMembership" ADD CONSTRAINT "TickerThemeMembership_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TickerThemeMembership" ADD CONSTRAINT "TickerThemeMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SupplyChainGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRelationship" ADD CONSTRAINT "GroupRelationship_sourceGroupId_fkey" FOREIGN KEY ("sourceGroupId") REFERENCES "SupplyChainGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRelationship" ADD CONSTRAINT "GroupRelationship_targetGroupId_fkey" FOREIGN KEY ("targetGroupId") REFERENCES "SupplyChainGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalystHypothesis" ADD CONSTRAINT "CatalystHypothesis_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalystHypothesis" ADD CONSTRAINT "CatalystHypothesis_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SupplyChainGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyRecommendation" ADD CONSTRAINT "StrategyRecommendation_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyRecommendation" ADD CONSTRAINT "StrategyRecommendation_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyRecommendation" ADD CONSTRAINT "StrategyRecommendation_catalystHypothesisId_fkey" FOREIGN KEY ("catalystHypothesisId") REFERENCES "CatalystHypothesis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationOutcome" ADD CONSTRAINT "RecommendationOutcome_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "StrategyRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
