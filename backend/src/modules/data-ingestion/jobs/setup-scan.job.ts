import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { SetupOrchestratorService } from '../../setup/setup-orchestrator.service';
import { Bar } from '../../../common/types';

/**
 * Setup scan job: runs after stage recalculation.
 * Scans all Stage 2 stocks for new setups.
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

    const stocks = await this.prisma.stock.findMany({
      where: { isActive: true },
      select: { id: true, ticker: true },
    });

    for (const stock of stocks) {
      try {
        const dailyBars = await this.prisma.stockDaily.findMany({
          where: { stockId: stock.id },
          orderBy: { date: 'asc' },
          take: 252, // 1 year of daily bars
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
}
