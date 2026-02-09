import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { YFinanceProvider } from '../providers/yfinance.provider';

interface StockSyncTask {
  stockId: string;
  ticker: string;
  isCurated: boolean;
  from: Date;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Returns the last trading day (skips weekends).
 */
function getLastTradingDay(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = now.getDay();
  // If Sunday (0), go back to Friday; if Saturday (6), go back to Friday
  if (day === 0) now.setDate(now.getDate() - 2);
  else if (day === 6) now.setDate(now.getDate() - 1);
  return now;
}

/**
 * Backfill service: fetches historical daily bars from Yahoo Finance.
 * Features per-stock gap detection, batched concurrency, and curated-first priority.
 */
@Injectable()
export class BackfillService {
  private readonly logger = new Logger(BackfillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly yfinance: YFinanceProvider,
  ) {}

  /**
   * Identify stocks that need syncing: either never synced or behind the last trading day.
   */
  async getStocksNeedingSync(): Promise<StockSyncTask[]> {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    twoYearsAgo.setHours(0, 0, 0, 0);

    const stocks = await this.prisma.stock.findMany({
      where: { isActive: true },
      select: {
        id: true,
        ticker: true,
        lastSyncDate: true,
        isCurated: true,
      },
    });

    const lastTradingDay = getLastTradingDay();

    return stocks
      .filter(
        (s) => !s.lastSyncDate || s.lastSyncDate < lastTradingDay,
      )
      .map((s) => ({
        stockId: s.id,
        ticker: s.ticker,
        isCurated: s.isCurated,
        from: s.lastSyncDate
          ? addDays(s.lastSyncDate, 1)
          : twoYearsAgo,
      }));
  }

  /**
   * Backfill all stocks needing sync. Curated stocks first for faster frontend data.
   * Batched: 5 concurrent requests + 500ms delay between batches.
   */
  async backfillAll(): Promise<{ synced: number; failed: number }> {
    const tasks = await this.getStocksNeedingSync();
    if (tasks.length === 0) {
      this.logger.log('All stocks up to date');
      return { synced: 0, failed: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Priority: curated stocks first (so frontend has data ASAP)
    const ordered = [
      ...tasks.filter((s) => s.isCurated),
      ...tasks.filter((s) => !s.isCurated),
    ];

    this.logger.log(
      `Backfilling ${ordered.length} stocks (${tasks.filter((s) => s.isCurated).length} curated first)`,
    );

    let synced = 0;
    let failed = 0;
    const batches = chunk(ordered, 5);

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      const results = await Promise.allSettled(
        batch.map((s) => this.syncSingleStock(s, today)),
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          synced++;
        } else {
          failed++;
        }
      }

      if ((batchIdx + 1) % 20 === 0) {
        this.logger.log(
          `Backfill progress: ${synced + failed}/${ordered.length} (${synced} synced, ${failed} failed)`,
        );
      }

      // Rate limit: 500ms between batches
      if (batchIdx < batches.length - 1) {
        await delay(500);
      }
    }

    this.logger.log(
      `Backfill complete: ${synced} synced, ${failed} failed out of ${ordered.length}`,
    );
    return { synced, failed };
  }

  /**
   * Backfill index daily bars (SPY, QQQ, DIA, IWM).
   */
  async backfillIndices(): Promise<void> {
    this.logger.log('Backfilling index data...');
    const indices = await this.prisma.indexEntity.findMany();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    twoYearsAgo.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const index of indices) {
      try {
        // Check latest bar date
        const latestBar = await this.prisma.indexDaily.findFirst({
          where: { indexId: index.id },
          orderBy: { date: 'desc' },
          select: { date: true },
        });

        const from = latestBar
          ? addDays(latestBar.date, 1)
          : twoYearsAgo;

        if (from > today) {
          this.logger.log(`Index ${index.ticker} already up to date`);
          continue;
        }

        const bars = await this.yfinance.fetchDailyBars(
          index.ticker,
          from,
          today,
        );

        if (bars.length > 0) {
          await this.prisma.indexDaily.createMany({
            data: bars.map((b) => ({
              indexId: index.id,
              date: b.date,
              open: b.open,
              high: b.high,
              low: b.low,
              close: b.close,
              volume: BigInt(Math.round(b.volume)),
            })),
            skipDuplicates: true,
          });
          this.logger.log(
            `Index ${index.ticker}: ${bars.length} bars synced`,
          );
        }
      } catch (err) {
        this.logger.error(`Failed to backfill index ${index.ticker}`, err);
      }
    }

    this.logger.log('Index backfill complete');
  }

  private async syncSingleStock(
    task: StockSyncTask,
    today: Date,
  ): Promise<boolean> {
    const bars = await this.yfinance.fetchDailyBars(
      task.ticker,
      task.from,
      today,
    );

    if (bars.length === 0) {
      // Still mark as synced to avoid retrying dead tickers endlessly
      await this.prisma.stock.update({
        where: { id: task.stockId },
        data: { lastSyncDate: today },
      });
      return true;
    }

    await this.prisma.stockDaily.createMany({
      data: bars.map((b) => ({
        stockId: task.stockId,
        date: b.date,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: BigInt(Math.round(b.volume)),
      })),
      skipDuplicates: true,
    });

    // Compute avgVolume from last 50 bars
    const recentBars = bars.slice(-50);
    const avgVol =
      recentBars.reduce((sum, b) => sum + b.volume, 0) / recentBars.length;

    await this.prisma.stock.update({
      where: { id: task.stockId },
      data: {
        lastSyncDate: today,
        avgVolume: BigInt(Math.round(avgVol)),
      },
    });

    return true;
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
