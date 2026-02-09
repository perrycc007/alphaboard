-- AlterTable
ALTER TABLE "Stock" ADD COLUMN     "isCurated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastSyncDate" DATE;
