ALTER TABLE "MarketConditionSnapshot"
ADD COLUMN "trendDetailJson" JSONB,
ADD COLUMN "breadthStructureJson" JSONB,
ADD COLUMN "equalWeightStructureJson" JSONB,
ADD COLUMN "setupPerformanceJson" JSONB;

ALTER TABLE "FocusListItem"
ADD COLUMN "identifiedSetupJson" JSONB;
