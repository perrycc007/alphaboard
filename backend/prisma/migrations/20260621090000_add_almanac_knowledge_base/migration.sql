-- CreateEnum
CREATE TYPE "AlmanacSourceConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "AlmanacSetupPhase" AS ENUM ('APPROACHING', 'TOUCHED', 'TRIGGERED', 'FAILED', 'NEGATIVE', 'REFERENCE');

-- CreateEnum
CREATE TYPE "AlmanacTradeLabel" AS ENUM ('VALID', 'UNCLEAR', 'FALSE_POSITIVE', 'REFERENCE_ONLY');

-- CreateTable
CREATE TABLE "AlmanacSource" (
    "id" TEXT NOT NULL,
    "pdfFileName" TEXT NOT NULL,
    "title" TEXT,
    "year" INTEGER,
    "quarter" INTEGER,
    "pageCount" INTEGER NOT NULL,
    "embeddedImageCount" INTEGER NOT NULL DEFAULT 0,
    "pdfPath" TEXT NOT NULL,
    "fileSizeBytes" BIGINT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlmanacSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlmanacReport" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "reportDate" DATE NOT NULL,
    "title" TEXT,
    "pageStart" INTEGER NOT NULL,
    "pageEnd" INTEGER NOT NULL,
    "marketContext" TEXT,
    "tickersJson" JSONB,
    "setupTagsJson" JSONB,
    "catalystTagsJson" JSONB,
    "mindsetTagsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlmanacReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlmanacChart" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "reportId" TEXT,
    "pageNumber" INTEGER NOT NULL,
    "imageNumber" INTEGER NOT NULL,
    "imagePath" TEXT,
    "chartType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "inferredTicker" TEXT,
    "inferredSetupTags" JSONB,
    "nearbyTextSnippet" TEXT,
    "sourceConfidence" "AlmanacSourceConfidence" NOT NULL DEFAULT 'LOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlmanacChart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlmanacTradeCase" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "reportId" TEXT,
    "chartId" TEXT,
    "ticker" TEXT NOT NULL,
    "setupTag" TEXT NOT NULL,
    "direction" "Direction",
    "phase" "AlmanacSetupPhase" NOT NULL DEFAULT 'REFERENCE',
    "keyLevelsJson" JSONB,
    "catalystTagsJson" JSONB,
    "mindsetTagsJson" JSONB,
    "timeframeStart" DATE,
    "timeframeEnd" DATE,
    "sourcePage" INTEGER NOT NULL,
    "sourceExcerpt" TEXT,
    "sourceConfidence" "AlmanacSourceConfidence" NOT NULL DEFAULT 'LOW',
    "label" "AlmanacTradeLabel" NOT NULL DEFAULT 'UNCLEAR',
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlmanacTradeCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlmanacDoctrine" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "reportId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "setupTagsJson" JSONB,
    "mindsetTagsJson" JSONB,
    "catalystTagsJson" JSONB,
    "sourcePage" INTEGER,
    "sourceExcerpt" TEXT,
    "sourceConfidence" "AlmanacSourceConfidence" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlmanacDoctrine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlmanacSource_pdfFileName_key" ON "AlmanacSource"("pdfFileName");

-- CreateIndex
CREATE INDEX "AlmanacSource_year_quarter_idx" ON "AlmanacSource"("year", "quarter");

-- CreateIndex
CREATE UNIQUE INDEX "AlmanacReport_sourceId_reportDate_pageStart_key" ON "AlmanacReport"("sourceId", "reportDate", "pageStart");

-- CreateIndex
CREATE INDEX "AlmanacReport_reportDate_idx" ON "AlmanacReport"("reportDate");

-- CreateIndex
CREATE INDEX "AlmanacReport_sourceId_pageStart_idx" ON "AlmanacReport"("sourceId", "pageStart");

-- CreateIndex
CREATE UNIQUE INDEX "AlmanacChart_sourceId_imageNumber_key" ON "AlmanacChart"("sourceId", "imageNumber");

-- CreateIndex
CREATE INDEX "AlmanacChart_sourceId_pageNumber_idx" ON "AlmanacChart"("sourceId", "pageNumber");

-- CreateIndex
CREATE INDEX "AlmanacChart_inferredTicker_idx" ON "AlmanacChart"("inferredTicker");

-- CreateIndex
CREATE UNIQUE INDEX "AlmanacTradeCase_sourceId_sourcePage_ticker_setupTag_key" ON "AlmanacTradeCase"("sourceId", "sourcePage", "ticker", "setupTag");

-- CreateIndex
CREATE INDEX "AlmanacTradeCase_ticker_idx" ON "AlmanacTradeCase"("ticker");

-- CreateIndex
CREATE INDEX "AlmanacTradeCase_setupTag_idx" ON "AlmanacTradeCase"("setupTag");

-- CreateIndex
CREATE INDEX "AlmanacTradeCase_label_idx" ON "AlmanacTradeCase"("label");

-- CreateIndex
CREATE INDEX "AlmanacTradeCase_sourcePage_idx" ON "AlmanacTradeCase"("sourcePage");

-- CreateIndex
CREATE INDEX "AlmanacDoctrine_title_idx" ON "AlmanacDoctrine"("title");

-- CreateIndex
CREATE INDEX "AlmanacDoctrine_sourcePage_idx" ON "AlmanacDoctrine"("sourcePage");

-- AddForeignKey
ALTER TABLE "AlmanacReport" ADD CONSTRAINT "AlmanacReport_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AlmanacSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlmanacChart" ADD CONSTRAINT "AlmanacChart_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AlmanacSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlmanacChart" ADD CONSTRAINT "AlmanacChart_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AlmanacReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlmanacTradeCase" ADD CONSTRAINT "AlmanacTradeCase_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AlmanacSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlmanacTradeCase" ADD CONSTRAINT "AlmanacTradeCase_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AlmanacReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlmanacTradeCase" ADD CONSTRAINT "AlmanacTradeCase_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "AlmanacChart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlmanacDoctrine" ADD CONSTRAINT "AlmanacDoctrine_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AlmanacSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlmanacDoctrine" ADD CONSTRAINT "AlmanacDoctrine_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AlmanacReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
