import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

interface StockRsData {
  stockId: string;
  ticker: string;
  latestBarId: string;
  rsRaw: number;
}

/**
 * IBD-style Relative Strength Rank computation.
 *
 * RS Raw = (2 * Q1%) + Q2% + Q3% + Q4%
 * where Q1 = last 63 trading days, Q2 = 63-126 days ago, etc.
 *
 * IPO adjustment: for stocks with < 252 bars, redistribute the total weight (5)
 * across available quarters, heavily weighting the most recent data.
 *
 * Final rank: percentile 1-99 across all active stocks.
 */
@Injectable()
export class RsRankService {
  private readonly logger = new Logger(RsRankService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute RS Rank for all active stocks and write to the latest StockDaily row.
   */
  async computeRanks(): Promise<number> {
    this.logger.log('Computing RS Ranks...');

    const stocks = await this.prisma.stock.findMany({
      where: { isActive: true },
      select: { id: true, ticker: true },
    });

    const rsDataList: StockRsData[] = [];

    for (const stock of stocks) {
      try {
        const bars = await this.prisma.stockDaily.findMany({
          where: { stockId: stock.id },
          orderBy: { date: 'desc' },
          take: 252,
          select: { id: true, close: true },
        });

        if (bars.length < 20) continue;

        // bars are newest-first from DB, reverse to oldest-first for computation
        const closes = bars.map((b) => Number(b.close)).reverse();
        const rsRaw = this.computeRsRaw(closes);

        if (rsRaw === null) continue;

        rsDataList.push({
          stockId: stock.id,
          ticker: stock.ticker,
          latestBarId: bars[0].id, // newest bar (first in desc order)
          rsRaw,
        });
      } catch {
        // Skip stocks that fail
      }
    }

    if (rsDataList.length === 0) {
      this.logger.log('No stocks with enough data for RS Rank');
      return 0;
    }

    // Sort by rsRaw ascending for percentile ranking
    rsDataList.sort((a, b) => a.rsRaw - b.rsRaw);

    // Assign percentile 1-99
    const total = rsDataList.length;
    const updates: { barId: string; rank: number }[] = [];

    for (let i = 0; i < total; i++) {
      const percentile = Math.max(
        1,
        Math.min(99, Math.round(((i + 1) / total) * 99)),
      );
      updates.push({ barId: rsDataList[i].latestBarId, rank: percentile });
    }

    // Batch update
    const BATCH_SIZE = 500;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      await this.prisma.$transaction(
        batch.map((u) =>
          this.prisma.stockDaily.update({
            where: { id: u.barId },
            data: { rsRank: u.rank },
          }),
        ),
      );
    }

    this.logger.log(
      `RS Rank computed for ${updates.length} stocks (percentile 1-99)`,
    );
    return updates.length;
  }

  /**
   * Compute raw RS score for a single stock.
   * closes: array ordered oldest-first, up to 252 bars.
   *
   * Returns weighted quarterly change score, or null if insufficient data.
   */
  computeRsRaw(closes: number[]): number | null {
    const n = closes.length;
    if (n < 20) return null;

    const latest = closes[n - 1];

    // Define quarter boundaries (from end of array)
    // Q1: last 63 bars (most recent quarter)
    // Q2: 64-126 bars ago
    // Q3: 127-189 bars ago
    // Q4: 190-252 bars ago
    const quarters: { start: number; end: number; weight: number }[] = [];

    if (n >= 63) {
      quarters.push({
        start: n - 63,
        end: n - 1,
        weight: 2,
      });
    }
    if (n >= 126) {
      quarters.push({
        start: n - 126,
        end: n - 64,
        weight: 1,
      });
    }
    if (n >= 189) {
      quarters.push({
        start: n - 189,
        end: n - 127,
        weight: 1,
      });
    }
    if (n >= 252) {
      quarters.push({
        start: n - 252,
        end: n - 190,
        weight: 1,
      });
    }

    if (quarters.length === 0) {
      // Fewer than 63 bars: use entire available range with full weight
      const change = (latest / closes[0] - 1) * 100;
      return change * 5; // All weight on available data
    }

    // Compute percentage change for each available quarter
    const quarterChanges: { change: number; weight: number }[] = [];
    for (const q of quarters) {
      const startPrice = closes[q.start];
      if (startPrice <= 0) continue;
      const endPrice = closes[q.end];
      const change = ((endPrice / startPrice) - 1) * 100;
      quarterChanges.push({ change, weight: q.weight });
    }

    if (quarterChanges.length === 0) return null;

    // IPO adjustment: redistribute total weight (5) across available quarters
    const totalOriginalWeight = quarterChanges.reduce(
      (sum, q) => sum + q.weight,
      0,
    );
    const weightMultiplier = 5 / totalOriginalWeight;

    let rsRaw = 0;
    for (const q of quarterChanges) {
      rsRaw += q.change * q.weight * weightMultiplier;
    }

    return rsRaw;
  }
}
