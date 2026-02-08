-- CreateEnum
CREATE TYPE "StageEnum" AS ENUM ('STAGE_1', 'STAGE_2', 'STAGE_3', 'STAGE_4');

-- CreateEnum
CREATE TYPE "StockCategory" AS ENUM ('HOT', 'FORMER_HOT', 'COMMODITY', 'NONE');

-- CreateEnum
CREATE TYPE "SwingType" AS ENUM ('HIGH', 'LOW');

-- CreateEnum
CREATE TYPE "Timeframe" AS ENUM ('DAILY', 'INTRADAY');

-- CreateEnum
CREATE TYPE "BaseStatus" AS ENUM ('FORMING', 'COMPLETE', 'BROKEN_OUT', 'FAILED');

-- CreateEnum
CREATE TYPE "SetupType" AS ENUM ('VCP', 'BREAKOUT_PIVOT', 'BREAKOUT_VCB', 'BREAKOUT_WEDGE', 'FAIL_BREAKOUT', 'FAIL_BASE', 'MOMENTUM_CONTINUATION', 'PULLBACK_BUY', 'UNDERCUT_RALLY', 'DOUBLE_TOP', 'INTRADAY_BASE', 'CROSS_620', 'GAP_UP', 'GAP_DOWN', 'TIRING_DOWN');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "SetupState" AS ENUM ('BUILDING', 'READY', 'TRIGGERED', 'VIOLATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EvidencePattern" AS ENUM ('DRY_UP', 'LOWER_WICK_ABSORPTION', 'BULLISH_ENGULFING', 'RESISTANCE_DRY_UP', 'UPPER_WICK_REJECTION', 'BEARISH_ENGULFING', 'SUPPORT_BROKEN', 'PIVOT_BROKEN', 'RESISTANCE_RECLAIMED');

-- CreateEnum
CREATE TYPE "EvidenceBias" AS ENUM ('BULLISH', 'BEARISH');

-- CreateEnum
CREATE TYPE "VolumeState" AS ENUM ('EXPANSION', 'CONTRACTION', 'NORMAL');

-- CreateEnum
CREATE TYPE "KeyLevelType" AS ENUM ('SWING_HIGH', 'SWING_LOW', 'BASE_LOW', 'BASE_HIGH', 'VCP_PIVOT', 'MA_20', 'MA_50', 'MA_200', 'VWAP');

-- CreateEnum
CREATE TYPE "TradeIdeaStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SKIPPED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'SUBMITTED', 'PARTIAL', 'FILLED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "Bias" AS ENUM ('BULLISH', 'BEARISH', 'BOTH');

-- CreateEnum
CREATE TYPE "RiskProfile" AS ENUM ('CONSERVATIVE', 'NORMAL', 'AGGRESSIVE');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PRICE_LEVEL', 'EMA_CROSS_620', 'SETUP_DETECTED', 'GROUP_CROSS', 'STAGE_CHANGE');

-- CreateTable
CREATE TABLE "Stock" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT,
    "industry" TEXT,
    "exchange" TEXT,
    "avgVolume" BIGINT,
    "marketCap" BIGINT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockDaily" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "open" DECIMAL(12,4) NOT NULL,
    "high" DECIMAL(12,4) NOT NULL,
    "low" DECIMAL(12,4) NOT NULL,
    "close" DECIMAL(12,4) NOT NULL,
    "volume" BIGINT NOT NULL,
    "sma20" DECIMAL(12,4),
    "sma50" DECIMAL(12,4),
    "sma150" DECIMAL(12,4),
    "sma200" DECIMAL(12,4),
    "ema6" DECIMAL(12,4),
    "ema20" DECIMAL(12,4),
    "rsRank" DECIMAL(6,2),
    "atr14" DECIMAL(12,4),

    CONSTRAINT "StockDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockIntraday" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(12,4) NOT NULL,
    "high" DECIMAL(12,4) NOT NULL,
    "low" DECIMAL(12,4) NOT NULL,
    "close" DECIMAL(12,4) NOT NULL,
    "volume" BIGINT NOT NULL,
    "ema6" DECIMAL(12,4),
    "ema20" DECIMAL(12,4),

    CONSTRAINT "StockIntraday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockStage" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "stage" "StageEnum" NOT NULL,
    "category" "StockCategory" NOT NULL,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "StockStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexEntity" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "IndexEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexDaily" (
    "id" TEXT NOT NULL,
    "indexId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "open" DECIMAL(12,4) NOT NULL,
    "high" DECIMAL(12,4) NOT NULL,
    "low" DECIMAL(12,4) NOT NULL,
    "close" DECIMAL(12,4) NOT NULL,
    "volume" BIGINT NOT NULL,

    CONSTRAINT "IndexDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreadthSnapshot" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "naad" DECIMAL(10,2),
    "naa50r" DECIMAL(6,2),
    "naa200r" DECIMAL(6,2),
    "nahl" DECIMAL(10,2),
    "avgWeightIdx" DECIMAL(12,4),

    CONSTRAINT "BreadthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyChainGroup" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SupplyChainGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemeStock" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "ThemeStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwingPoint" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "type" "SwingType" NOT NULL,
    "timeframe" "Timeframe" NOT NULL,
    "price" DECIMAL(12,4) NOT NULL,
    "barDate" TIMESTAMP(3) NOT NULL,
    "absValue" DECIMAL(12,4) NOT NULL,
    "lookahead" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SwingPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyBase" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "peakPrice" DECIMAL(12,4) NOT NULL,
    "peakDate" DATE NOT NULL,
    "baseLow" DECIMAL(12,4) NOT NULL,
    "retracePct" DECIMAL(6,4) NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "pivotPrice" DECIMAL(12,4),
    "status" "BaseStatus" NOT NULL DEFAULT 'FORMING',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setup" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "type" "SetupType" NOT NULL,
    "timeframe" "Timeframe" NOT NULL,
    "direction" "Direction" NOT NULL,
    "state" "SetupState" NOT NULL DEFAULT 'BUILDING',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "lastStateAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pivotPrice" DECIMAL(12,4),
    "stopPrice" DECIMAL(12,4),
    "targetPrice" DECIMAL(12,4),
    "riskReward" DECIMAL(6,2),
    "evidence" JSONB,
    "waitingFor" TEXT,
    "metadata" JSONB,
    "dailyBaseId" TEXT,

    CONSTRAINT "Setup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarEvidence" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "timeframe" "Timeframe" NOT NULL,
    "barDate" TIMESTAMP(3) NOT NULL,
    "pattern" "EvidencePattern" NOT NULL,
    "bias" "EvidenceBias" NOT NULL,
    "isViolation" BOOLEAN NOT NULL DEFAULT false,
    "keyLevelType" "KeyLevelType" NOT NULL,
    "keyLevelPrice" DECIMAL(12,4) NOT NULL,
    "volumeState" "VolumeState" NOT NULL,
    "setupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeIdea" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "setupId" TEXT,
    "stockId" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "bias" "Bias" NOT NULL,
    "entryPrice" DECIMAL(12,4),
    "stopPrice" DECIMAL(12,4) NOT NULL,
    "targetPrice" DECIMAL(12,4),
    "riskPercent" DECIMAL(4,2) NOT NULL,
    "riskReward" DECIMAL(6,2),
    "status" "TradeIdeaStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "TradeIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeIntent" (
    "id" TEXT NOT NULL,
    "tradeIdeaId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "brokerOrderId" TEXT,
    "type" "OrderType" NOT NULL,
    "side" "Direction" NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "limitPrice" DECIMAL(12,4),
    "stopPrice" DECIMAL(12,4),
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "price" DECIMAL(12,4) NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "fee" DECIMAL(12,4),
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "positionId" TEXT,

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "ticker" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "avgEntry" DECIMAL(12,4) NOT NULL,
    "currentStop" DECIMAL(12,4),
    "realizedPnl" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "unrealizedPnl" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "status" "PositionStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultRiskPct" DECIMAL(4,2) NOT NULL DEFAULT 0.5,
    "riskProfile" "RiskProfile" NOT NULL DEFAULT 'NORMAL',

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "watchlistId" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stockId" TEXT,
    "type" "AlertType" NOT NULL,
    "condition" JSONB NOT NULL,
    "isTriggered" BOOLEAN NOT NULL DEFAULT false,
    "triggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Stock_ticker_key" ON "Stock"("ticker");

-- CreateIndex
CREATE INDEX "StockDaily_date_idx" ON "StockDaily"("date");

-- CreateIndex
CREATE INDEX "StockDaily_stockId_date_idx" ON "StockDaily"("stockId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "StockDaily_stockId_date_key" ON "StockDaily"("stockId", "date");

-- CreateIndex
CREATE INDEX "StockIntraday_stockId_timestamp_idx" ON "StockIntraday"("stockId", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "StockIntraday_stockId_timestamp_key" ON "StockIntraday"("stockId", "timestamp");

-- CreateIndex
CREATE INDEX "StockStage_date_stage_idx" ON "StockStage"("date", "stage");

-- CreateIndex
CREATE INDEX "StockStage_date_category_idx" ON "StockStage"("date", "category");

-- CreateIndex
CREATE UNIQUE INDEX "StockStage_stockId_date_key" ON "StockStage"("stockId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "IndexEntity_ticker_key" ON "IndexEntity"("ticker");

-- CreateIndex
CREATE INDEX "IndexDaily_date_idx" ON "IndexDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "IndexDaily_indexId_date_key" ON "IndexDaily"("indexId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BreadthSnapshot_date_key" ON "BreadthSnapshot"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Theme_name_key" ON "Theme"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyChainGroup_themeId_name_key" ON "SupplyChainGroup"("themeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ThemeStock_stockId_groupId_key" ON "ThemeStock"("stockId", "groupId");

-- CreateIndex
CREATE INDEX "SwingPoint_stockId_timeframe_type_idx" ON "SwingPoint"("stockId", "timeframe", "type");

-- CreateIndex
CREATE INDEX "SwingPoint_stockId_barDate_idx" ON "SwingPoint"("stockId", "barDate");

-- CreateIndex
CREATE INDEX "DailyBase_stockId_status_idx" ON "DailyBase"("stockId", "status");

-- CreateIndex
CREATE INDEX "Setup_state_type_idx" ON "Setup"("state", "type");

-- CreateIndex
CREATE INDEX "Setup_timeframe_state_idx" ON "Setup"("timeframe", "state");

-- CreateIndex
CREATE INDEX "Setup_detectedAt_idx" ON "Setup"("detectedAt");

-- CreateIndex
CREATE INDEX "Setup_stockId_state_idx" ON "Setup"("stockId", "state");

-- CreateIndex
CREATE INDEX "BarEvidence_stockId_timeframe_barDate_idx" ON "BarEvidence"("stockId", "timeframe", "barDate");

-- CreateIndex
CREATE INDEX "BarEvidence_setupId_idx" ON "BarEvidence"("setupId");

-- CreateIndex
CREATE INDEX "TradeIdea_userId_status_idx" ON "TradeIdea"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TradeIntent_tradeIdeaId_key" ON "TradeIntent"("tradeIdeaId");

-- CreateIndex
CREATE INDEX "Position_userId_status_idx" ON "Position"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_name_key" ON "Watchlist"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_watchlistId_stockId_key" ON "WatchlistItem"("watchlistId", "stockId");

-- AddForeignKey
ALTER TABLE "StockDaily" ADD CONSTRAINT "StockDaily_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockIntraday" ADD CONSTRAINT "StockIntraday_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockStage" ADD CONSTRAINT "StockStage_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndexDaily" ADD CONSTRAINT "IndexDaily_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "IndexEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyChainGroup" ADD CONSTRAINT "SupplyChainGroup_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeStock" ADD CONSTRAINT "ThemeStock_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeStock" ADD CONSTRAINT "ThemeStock_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SupplyChainGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwingPoint" ADD CONSTRAINT "SwingPoint_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyBase" ADD CONSTRAINT "DailyBase_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setup" ADD CONSTRAINT "Setup_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarEvidence" ADD CONSTRAINT "BarEvidence_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarEvidence" ADD CONSTRAINT "BarEvidence_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeIdea" ADD CONSTRAINT "TradeIdea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeIdea" ADD CONSTRAINT "TradeIdea_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeIntent" ADD CONSTRAINT "TradeIntent_tradeIdeaId_fkey" FOREIGN KEY ("tradeIdeaId") REFERENCES "TradeIdea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "TradeIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "Watchlist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
