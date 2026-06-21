-- CreateEnum
CREATE TYPE "CatalystKind" AS ENUM ('CURRENT', 'HISTORICAL', 'PATTERN');

-- CreateEnum
CREATE TYPE "CatalystImpactDirection" AS ENUM ('BENEFITS', 'HARMS', 'MIXED');

-- CreateEnum
CREATE TYPE "CatalystImpactTimeframe" AS ENUM ('IMMEDIATE', 'SHORT_TERM', 'MEDIUM_TERM', 'LONG_TERM');

-- AlterTable
ALTER TABLE "CatalystHypothesis"
  ADD COLUMN "kind" "CatalystKind" NOT NULL DEFAULT 'CURRENT',
  ADD COLUMN "eventCategory" TEXT,
  ADD COLUMN "observedStartDate" DATE,
  ADD COLUMN "observedEndDate" DATE;

-- CreateTable
CREATE TABLE "CatalystMechanism" (
  "id" TEXT NOT NULL,
  "catalystId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "evidenceJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalystMechanism_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalystImpact" (
  "id" TEXT NOT NULL,
  "mechanismId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "direction" "CatalystImpactDirection" NOT NULL,
  "relationshipType" "RelationshipType",
  "strengthScore" DECIMAL(4,3),
  "timeframe" "CatalystImpactTimeframe",
  "notes" TEXT,
  "evidenceJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalystImpact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalystHypothesis_kind_createdAt_idx" ON "CatalystHypothesis"("kind", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CatalystMechanism_catalystId_title_key" ON "CatalystMechanism"("catalystId", "title");

-- CreateIndex
CREATE INDEX "CatalystMechanism_catalystId_sortOrder_idx" ON "CatalystMechanism"("catalystId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CatalystImpact_mechanismId_groupId_direction_key" ON "CatalystImpact"("mechanismId", "groupId", "direction");

-- CreateIndex
CREATE INDEX "CatalystImpact_groupId_idx" ON "CatalystImpact"("groupId");

-- CreateIndex
CREATE INDEX "CatalystImpact_direction_idx" ON "CatalystImpact"("direction");

-- AddForeignKey
ALTER TABLE "CatalystMechanism" ADD CONSTRAINT "CatalystMechanism_catalystId_fkey" FOREIGN KEY ("catalystId") REFERENCES "CatalystHypothesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalystImpact" ADD CONSTRAINT "CatalystImpact_mechanismId_fkey" FOREIGN KEY ("mechanismId") REFERENCES "CatalystMechanism"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalystImpact" ADD CONSTRAINT "CatalystImpact_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SupplyChainGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
