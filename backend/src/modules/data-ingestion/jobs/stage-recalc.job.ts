import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { StageClassifierService } from '../../stock/services/stage-classifier.service';

/**
 * Stage recalculation job: runs after daily sync.
 * Recalculates stage classification for all active stocks.
 */
@Injectable()
export class StageRecalcJob {
  private readonly logger = new Logger(StageRecalcJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stageClassifier: StageClassifierService,
  ) {}

  @Cron('30 17 * * 1-5') // 5:30 PM EST, after daily sync
  async run(): Promise<void> {
    this.logger.log('Starting stage recalculation...');

    const stocks = await this.prisma.stock.findMany({
      where: { isActive: true },
      select: { id: true, ticker: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const stock of stocks) {
      try {
        // Get latest daily bar with indicators
        const latestBar = await this.prisma.stockDaily.findFirst({
          where: { stockId: stock.id },
          orderBy: { date: 'desc' },
        });

        if (
          !latestBar?.sma50 ||
          !latestBar?.sma150 ||
          !latestBar?.sma200
        ) {
          continue; // Not enough data
        }

        // Get 200MA from 30 days ago
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const oldBar = await this.prisma.stockDaily.findFirst({
          where: { stockId: stock.id, date: { lte: thirtyDaysAgo } },
          orderBy: { date: 'desc' },
        });

        // Get 52-week high/low
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const yearBars = await this.prisma.stockDaily.findMany({
          where: { stockId: stock.id, date: { gte: oneYearAgo } },
          select: { high: true, low: true },
        });

        if (yearBars.length === 0) continue;

        const high52w = Math.max(...yearBars.map((b) => Number(b.high)));
        const low52w = Math.min(...yearBars.map((b) => Number(b.low)));

        const classification = this.stageClassifier.classify(
          Number(latestBar.close),
          Number(latestBar.sma50),
          Number(latestBar.sma150),
          Number(latestBar.sma200),
          oldBar?.sma200 ? Number(oldBar.sma200) : Number(latestBar.sma200),
          high52w,
          low52w,
        );

        await this.prisma.stockStage.upsert({
          where: {
            stockId_date: { stockId: stock.id, date: today },
          },
          create: {
            stockId: stock.id,
            date: today,
            stage: classification.stage,
            category: classification.category,
            isTemplate: classification.isTemplate,
            metadata: classification.criteria,
          },
          update: {
            stage: classification.stage,
            category: classification.category,
            isTemplate: classification.isTemplate,
            metadata: classification.criteria,
          },
        });
      } catch (err) {
        this.logger.error(`Failed stage recalc for ${stock.ticker}`, err);
      }
    }

    this.logger.log('Stage recalculation complete');
  }
}
