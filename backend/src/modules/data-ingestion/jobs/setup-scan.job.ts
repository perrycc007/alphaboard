import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { SetupOrchestratorService } from '../../setup/setup-orchestrator.service';
import { Bar } from '../../../common/types';
import { MarketRegimeService } from '../../market/market-regime.service';

/**
 * Setup scan job: runs after stage recalculation.
 * Scans only qualifying stocks for new setups:
 * - Stage 2 stocks
 * - Past leaders (FORMER_HOT)
 * - Commodity/Mining (Energy, Materials sectors)
 * - Biotech/Pharma (by industry)
 * All must pass volume >= 200K avg and price >= $5 filters.
 */
@Injectable()
export class SetupScanJob {
  private readonly logger = new Logger(SetupScanJob.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: SetupOrchestratorService,
    private readonly marketRegimeService: MarketRegimeService,
  ) {}

  @Cron('0 18 * * 1-5') // 6:00 PM EST, after stage recalc
  async run(): Promise<void> {
    if (this.running) {
      throw new Error('Setup scan is already running');
    }

    this.running = true;
    try {
      this.logger.log('Starting setup scan...');
      this.logMemory('Setup scan start');
      await this.marketRegimeService.rebuildLeaderRuns();

      const candidates = await this.getSetupCandidates();
      this.logger.log(`Found ${candidates.length} setup candidates after filtering`);

      for (let i = 0; i < candidates.length; i++) {
        const stock = candidates[i];
        try {
          const dailyBars = await this.prisma.stockDaily.findMany({
            where: { stockId: stock.id },
            orderBy: { date: 'desc' },
            take: 252,
          });

          if (dailyBars.length < 50) continue;

          const bars: Bar[] = dailyBars.reverse().map((b) => ({
            open: Number(b.open),
            high: Number(b.high),
            low: Number(b.low),
            close: Number(b.close),
            volume: Number(b.volume),
            date: b.date,
          }));

          await this.orchestrator.runDailyDetection(stock.id, bars);
        } catch (err) {
          this.logger.error(`Failed setup scan for ${stock.ticker}`, err);
        }

        if ((i + 1) % 100 === 0) {
          this.logger.log(`Setup scan progress: ${i + 1}/${candidates.length}`);
          this.logMemory('Setup scan progress');
        }
      }

      this.logger.log('Setup scan complete');
      this.logMemory('Setup scan complete');
    } finally {
      this.running = false;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get stocks qualifying for setup detection.
   * Filters: volume >= 200K, price >= $5, and one of:
   * Stage 2, Past Leader, Commodity/Mining sector, or Biotech/Pharma industry.
   */
  private async getSetupCandidates(): Promise<
    { id: string; ticker: string }[]
  > {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all active stocks with sufficient volume
    const candidates = await this.prisma.stock.findMany({
      where: {
        isActive: true,
        avgVolume: { gte: 200_000 },
        OR: [
          // Stage 2 stocks (most recent stage record)
          {
            stages: {
              some: {
                stage: 'STAGE_2',
              },
            },
          },
          // Qualified past leaders
          {
            leaderRuns: {
              some: {
                isQualified: true,
              },
            },
          },
          // Commodity/Mining by sector
          { sector: { in: ['Energy', 'Materials'] } },
          // Biotech/Pharma by industry
          { industry: { contains: 'Biotech' } },
          { industry: { contains: 'Pharma' } },
        ],
      },
      select: { id: true, ticker: true },
    });

    // Additional price filter: check latest bar close >= $5 without one query
    // per candidate.
    const latestCloseByStock = await this.getLatestClosesByStock(
      candidates.map((stock) => stock.id),
    );
    const filtered: { id: string; ticker: string }[] = [];
    for (const stock of candidates) {
      const latestClose = latestCloseByStock.get(stock.id);
      if (latestClose != null && latestClose >= 5.0) {
        filtered.push(stock);
      }
    }

    return filtered;
  }

  private async getLatestClosesByStock(
    stockIds: string[],
  ): Promise<Map<string, number>> {
    const latestByStock = new Map<string, number>();
    const chunkSize = 1000;

    for (let i = 0; i < stockIds.length; i += chunkSize) {
      const chunk = stockIds.slice(i, i + chunkSize);
      if (chunk.length === 0) continue;

      const rows = await this.prisma.$queryRaw<
        Array<{ stockId: string; close: Prisma.Decimal }>
      >(
        Prisma.sql`
          SELECT DISTINCT ON ("stockId") "stockId", "close"
          FROM "StockDaily"
          WHERE "stockId" IN (${Prisma.join(chunk)})
          ORDER BY "stockId", "date" DESC
        `,
      );

      for (const row of rows) {
        latestByStock.set(row.stockId, Number(row.close));
      }
    }

    return latestByStock;
  }

  private logMemory(label: string): void {
    const usage = process.memoryUsage();
    this.logger.log(
      `${label} memory rss=${Math.round(usage.rss / 1024 / 1024)}MB heapUsed=${Math.round(usage.heapUsed / 1024 / 1024)}MB heapTotal=${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    );
  }
}
