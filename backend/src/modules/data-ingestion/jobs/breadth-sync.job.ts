import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Breadth sync job: computes market breadth indicators from the full stock universe.
 * NAAD  = advancing - declining stocks
 * NAA50R = % of stocks above 50-day SMA
 * NAA200R = % of stocks above 200-day SMA
 * NAHL = 52-week new highs - new lows
 */
@Injectable()
export class BreadthSyncJob {
  private readonly logger = new Logger(BreadthSyncJob.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('15 17 * * 1-5') // 5:15 PM, after daily sync
  async run(): Promise<void> {
    this.logger.log('Starting breadth computation...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all active stocks with their two most recent bars + latest indicators
    const stocks = await this.prisma.stock.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    let advancing = 0;
    let declining = 0;
    let above50 = 0;
    let above200 = 0;
    let newHighs = 0;
    let newLows = 0;
    let totalWithData = 0;

    for (const stock of stocks) {
      try {
        // Get the two most recent bars (for advance/decline)
        const recentBars = await this.prisma.stockDaily.findMany({
          where: { stockId: stock.id },
          orderBy: { date: 'desc' },
          take: 2,
          select: { close: true, sma50: true, sma200: true, high: true, low: true },
        });

        if (recentBars.length < 2) continue;
        totalWithData++;

        const todayBar = recentBars[0];
        const yesterdayBar = recentBars[1];
        const todayClose = Number(todayBar.close);
        const yesterdayClose = Number(yesterdayBar.close);

        // NAAD: advancing vs declining
        if (todayClose > yesterdayClose) advancing++;
        else if (todayClose < yesterdayClose) declining++;

        // NAA50R: close > sma50
        if (todayBar.sma50 !== null && todayClose > Number(todayBar.sma50)) {
          above50++;
        }

        // NAA200R: close > sma200
        if (todayBar.sma200 !== null && todayClose > Number(todayBar.sma200)) {
          above200++;
        }

        // NAHL: 52-week new highs / lows
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const yearExtremes = await this.prisma.stockDaily.aggregate({
          where: {
            stockId: stock.id,
            date: { gte: oneYearAgo },
          },
          _max: { high: true },
          _min: { low: true },
        });

        if (yearExtremes._max.high !== null) {
          const yearHigh = Number(yearExtremes._max.high);
          const yearLow = Number(yearExtremes._min.low);
          const currentHigh = Number(todayBar.high);
          const currentLow = Number(todayBar.low);

          // New 52-week high if today's high equals or exceeds yearly high
          if (currentHigh >= yearHigh * 0.99) newHighs++;
          // New 52-week low if today's low equals or is below yearly low
          if (currentLow <= yearLow * 1.01) newLows++;
        }
      } catch {
        // Skip stocks that fail
      }
    }

    const naad = advancing - declining;
    const naa50r = totalWithData > 0 ? (above50 / totalWithData) * 100 : 0;
    const naa200r = totalWithData > 0 ? (above200 / totalWithData) * 100 : 0;
    const nahl = newHighs - newLows;

    await this.prisma.breadthSnapshot.upsert({
      where: { date: today },
      create: {
        date: today,
        naad,
        naa50r,
        naa200r,
        nahl,
      },
      update: {
        naad,
        naa50r,
        naa200r,
        nahl,
      },
    });

    this.logger.log(
      `Breadth computed: NAAD=${naad}, NAA50R=${naa50r.toFixed(1)}%, NAA200R=${naa200r.toFixed(1)}%, NAHL=${nahl} (${totalWithData} stocks analyzed)`,
    );
  }
}
