import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { YFinanceProvider } from '../providers/yfinance.provider';

@Injectable()
export class DailySyncJob {
  private readonly logger = new Logger(DailySyncJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly yfinance: YFinanceProvider,
  ) {}

  @Cron('0 17 * * 1-5')
  async run(): Promise<void> {
    this.logger.log('Starting daily sync...');

    const stocks = await this.prisma.stock.findMany({
      where: { isActive: true },
      select: { id: true, ticker: true },
    });

    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 5);

    for (const stock of stocks) {
      try {
        const bars = await this.yfinance.fetchDailyBars(
          stock.ticker,
          from,
          today,
        );

        for (const bar of bars) {
          await this.prisma.stockDaily.upsert({
            where: {
              stockId_date: { stockId: stock.id, date: bar.date },
            },
            create: {
              stockId: stock.id,
              date: bar.date,
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              volume: BigInt(Math.round(bar.volume)),
            },
            update: {
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              volume: BigInt(Math.round(bar.volume)),
            },
          });
        }
      } catch (err) {
        this.logger.error(`Failed to sync ${stock.ticker}`, err);
      }
    }

    const indices = await this.prisma.indexEntity.findMany();
    for (const index of indices) {
      try {
        const bars = await this.yfinance.fetchDailyBars(
          index.ticker,
          from,
          today,
        );
        for (const bar of bars) {
          await this.prisma.indexDaily.upsert({
            where: {
              indexId_date: { indexId: index.id, date: bar.date },
            },
            create: {
              indexId: index.id,
              date: bar.date,
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              volume: BigInt(Math.round(bar.volume)),
            },
            update: {
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              volume: BigInt(Math.round(bar.volume)),
            },
          });
        }
      } catch (err) {
        this.logger.error(`Failed to sync index ${index.ticker}`, err);
      }
    }

    this.logger.log('Daily sync complete');
  }
}
