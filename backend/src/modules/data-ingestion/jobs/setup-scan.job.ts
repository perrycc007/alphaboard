import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { SetupOrchestratorService } from '../../setup/setup-orchestrator.service';
import { Bar } from '../../../common/types';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: SetupOrchestratorService,
  ) {}

  @Cron('0 18 * * 1-5') // 6:00 PM EST, after stage recalc
  async run(): Promise<void> {
    this.logger.log('Starting setup scan...');

    const candidates = await this.getSetupCandidates();
    this.logger.log(`Found ${candidates.length} setup candidates after filtering`);

    for (const stock of candidates) {
      try {
        const dailyBars = await this.prisma.stockDaily.findMany({
          where: { stockId: stock.id },
          orderBy: { date: 'asc' },
          take: 252,
        });

        if (dailyBars.length < 50) continue;

        const bars: Bar[] = dailyBars.map((b) => ({
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
    }

    this.logger.log('Setup scan complete');
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
          // Past leaders
          {
            stages: {
              some: {
                category: 'FORMER_HOT',
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

    // Additional price filter: check latest bar close >= $5
    const filtered: { id: string; ticker: string }[] = [];
    for (const stock of candidates) {
      const latestBar = await this.prisma.stockDaily.findFirst({
        where: { stockId: stock.id },
        orderBy: { date: 'desc' },
        select: { close: true },
      });
      if (latestBar && Number(latestBar.close) >= 5.0) {
        filtered.push(stock);
      }
    }

    return filtered;
  }
}
