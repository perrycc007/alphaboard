import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { PolygonProvider } from '../providers/polygon.provider';
import { SetupOrchestratorService } from '../../setup/setup-orchestrator.service';
import { AlertGateway } from '../../alert/alert.gateway';
import { Bar } from '../../../common/types';

/**
 * Intraday sync job: runs every 5 minutes during market hours.
 * - Fetches 5-min bars for watched stocks
 * - Computes intraday EMAs
 * - Runs setup orchestrator per bar
 * - Pushes live bar data to WebSocket clients
 */
@Injectable()
export class IntradaySyncJob {
  private readonly logger = new Logger(IntradaySyncJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly polygon: PolygonProvider,
    private readonly orchestrator: SetupOrchestratorService,
    private readonly alertGateway: AlertGateway,
  ) {}

  @Cron('*/5 9-16 * * 1-5') // Every 5 min, 9 AM - 4 PM, weekdays
  async run(): Promise<void> {
    // Skip entirely if Polygon is not configured (no API key)
    if (!this.polygon.isConfigured()) return;

    const stocks = await this.prisma.stock.findMany({
      where: { isActive: true },
      select: { id: true, ticker: true },
    });

    const today = new Date();

    for (const stock of stocks) {
      try {
        const bars = await this.polygon.fetchIntradayBars(
          stock.ticker,
          today,
        );

        for (const bar of bars) {
          await this.prisma.stockIntraday.upsert({
            where: {
              stockId_timestamp: {
                stockId: stock.id,
                timestamp: bar.timestamp,
              },
            },
            create: {
              stockId: stock.id,
              timestamp: bar.timestamp,
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

          // Push to WebSocket
          this.alertGateway.sendIntradayBar(stock.ticker, {
            timestamp: bar.timestamp,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
          });
        }

        // Run intraday detection on latest bars
        if (bars.length > 0) {
          const intradayBars: Bar[] = bars.map((b) => ({
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
            volume: b.volume,
            timestamp: b.timestamp,
          }));

          await this.orchestrator.processIntradayBar(stock.id, intradayBars, {
            swingPoints: [],
            bases: [],
            indicators: {},
            avgVolume: 0,
            avgRange: 0,
          });
        }
      } catch (err) {
        this.logger.error(`Failed intraday sync for ${stock.ticker}`, err);
      }
    }
  }
}
