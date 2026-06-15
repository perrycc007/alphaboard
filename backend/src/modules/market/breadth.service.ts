import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface MissingBreadthRow {
  date: Date;
  naad: Prisma.Decimal | null;
  naa50r: Prisma.Decimal | null;
  naa200r: Prisma.Decimal | null;
  nahl: Prisma.Decimal | null;
}

@Injectable()
export class BreadthService {
  private readonly logger = new Logger(BreadthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getLatest() {
    return this.prisma.breadthSnapshot.findFirst({
      orderBy: { date: 'desc' },
    });
  }

  async getTimeSeries(range?: string) {
    const dateFilter = range ? this.buildDateFilter(range) : {};
    return this.prisma.breadthSnapshot.findMany({
      where: dateFilter,
      orderBy: { date: 'asc' },
    });
  }

  async backfillMissing(years = 5): Promise<{
    created: number;
    startDate: Date;
    endDate: Date;
  }> {
    const safeYears = Number.isFinite(years) && years > 0 ? years : 5;
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);
    const startDate = new Date(endDate);
    startDate.setFullYear(startDate.getFullYear() - safeYears);
    const warmupDate = new Date(startDate);
    warmupDate.setDate(warmupDate.getDate() - 370);

    const rows = await this.prisma.$queryRaw<MissingBreadthRow[]>(
      Prisma.sql`
        WITH stock_rows AS (
          SELECT
            sd."stockId",
            sd."date",
            sd."close",
            sd."high",
            sd."low",
            sd."sma50",
            sd."sma200",
            LAG(sd."close") OVER (
              PARTITION BY sd."stockId"
              ORDER BY sd."date"
            ) AS "prevClose",
            MAX(sd."high") OVER (
              PARTITION BY sd."stockId"
              ORDER BY sd."date"
              ROWS BETWEEN 251 PRECEDING AND CURRENT ROW
            ) AS "high252",
            MIN(sd."low") OVER (
              PARTITION BY sd."stockId"
              ORDER BY sd."date"
              ROWS BETWEEN 251 PRECEDING AND CURRENT ROW
            ) AS "low252"
          FROM "StockDaily" sd
          INNER JOIN "Stock" s ON s."id" = sd."stockId"
          WHERE s."isActive" = true
            AND sd."date" >= ${warmupDate}
            AND sd."date" <= ${endDate}
        ),
        missing_dates AS (
          SELECT DISTINCT sr."date"
          FROM stock_rows sr
          LEFT JOIN "BreadthSnapshot" bs ON bs."date" = sr."date"
          WHERE sr."date" >= ${startDate}
            AND bs."id" IS NULL
        )
        SELECT
          sr."date",
          (
            SUM(CASE WHEN sr."prevClose" IS NOT NULL AND sr."close" > sr."prevClose" THEN 1 ELSE 0 END) -
            SUM(CASE WHEN sr."prevClose" IS NOT NULL AND sr."close" < sr."prevClose" THEN 1 ELSE 0 END)
          )::numeric AS "naad",
          (
            SUM(CASE WHEN sr."prevClose" IS NOT NULL AND sr."sma50" IS NOT NULL AND sr."close" > sr."sma50" THEN 1 ELSE 0 END) * 100.0 /
            NULLIF(SUM(CASE WHEN sr."prevClose" IS NOT NULL THEN 1 ELSE 0 END), 0)
          )::numeric AS "naa50r",
          (
            SUM(CASE WHEN sr."prevClose" IS NOT NULL AND sr."sma200" IS NOT NULL AND sr."close" > sr."sma200" THEN 1 ELSE 0 END) * 100.0 /
            NULLIF(SUM(CASE WHEN sr."prevClose" IS NOT NULL THEN 1 ELSE 0 END), 0)
          )::numeric AS "naa200r",
          (
            SUM(CASE WHEN sr."prevClose" IS NOT NULL AND sr."high" >= sr."high252" * 0.99 THEN 1 ELSE 0 END) -
            SUM(CASE WHEN sr."prevClose" IS NOT NULL AND sr."low" <= sr."low252" * 1.01 THEN 1 ELSE 0 END)
          )::numeric AS "nahl"
        FROM stock_rows sr
        INNER JOIN missing_dates md ON md."date" = sr."date"
        GROUP BY sr."date"
        HAVING SUM(CASE WHEN sr."prevClose" IS NOT NULL THEN 1 ELSE 0 END) > 0
        ORDER BY sr."date" ASC
      `,
    );

    if (rows.length > 0) {
      await this.prisma.breadthSnapshot.createMany({
        data: rows.map((row) => ({
          date: row.date,
          naad: row.naad,
          naa50r: row.naa50r,
          naa200r: row.naa200r,
          nahl: row.nahl,
        })),
        skipDuplicates: true,
      });
    }

    this.logger.log(
      `Backfilled ${rows.length} missing breadth snapshots from ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`,
    );

    return { created: rows.length, startDate, endDate };
  }

  private buildDateFilter(range: string): { date?: { gte: Date } } {
    const since = new Date();
    const normalized = range.trim().toLowerCase();
    if (normalized.endsWith('y')) {
      const years = parseInt(normalized.replace('y', ''), 10);
      if (isNaN(years)) return {};
      since.setFullYear(since.getFullYear() - years);
      return { date: { gte: since } };
    }

    const days = parseInt(normalized.replace('d', ''), 10);
    if (isNaN(days)) return {};
    since.setDate(since.getDate() - days);
    return { date: { gte: since } };
  }
}
