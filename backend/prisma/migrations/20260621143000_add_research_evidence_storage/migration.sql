-- CreateEnum
CREATE TYPE "SupplyChainLayer" AS ENUM (
  'INPUT',
  'EQUIPMENT',
  'COMPONENT',
  'INFRASTRUCTURE',
  'PLATFORM',
  'APPLICATION',
  'DISTRIBUTION',
  'END_MARKET',
  'FINANCING'
);

-- AlterTable
ALTER TABLE "Stock"
  ADD COLUMN "metadataEvidenceJson" JSONB;

-- AlterTable
ALTER TABLE "SupplyChainGroup"
  ADD COLUMN "layer" "SupplyChainLayer",
  ADD COLUMN "evidenceJson" JSONB;

-- AlterTable
ALTER TABLE "TickerThemeMembership"
  ADD COLUMN "evidenceJson" JSONB;

-- AlterTable
ALTER TABLE "GroupRelationship"
  ADD COLUMN "eventCategory" TEXT,
  ADD COLUMN "evidenceJson" JSONB;

-- AlterTable
ALTER TABLE "CatalystHypothesis"
  ADD COLUMN "evidenceJson" JSONB;
