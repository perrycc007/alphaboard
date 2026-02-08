import { Injectable, Logger } from '@nestjs/common';
import { MarketDataProvider, DailyBarData } from './market-data.provider';
import YahooFinance from 'yahoo-finance2';

/**
 * Yahoo Finance provider for historical daily OHLCV data.
 * Uses the yahoo-finance2 Node.js library to fetch bars directly.
 */
@Injectable()
export class YFinanceProvider implements MarketDataProvider {
  private readonly logger = new Logger(YFinanceProvider.name);
  private readonly yf = new YahooFinance({
    suppressNotices: ['ripHistorical'],
  });

  async fetchDailyBars(
    ticker: string,
    from: Date,
    to: Date,
  ): Promise<DailyBarData[]> {
    this.logger.log(
      `Fetching daily bars for ${ticker} from ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`,
    );

    try {
      const result = await this.yf.historical(ticker, {
        period1: from,
        period2: to,
        interval: '1d',
      });

      const bars: DailyBarData[] = result.map((row) => ({
        date: row.date,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
      }));

      this.logger.log(`Fetched ${bars.length} daily bars for ${ticker}`);
      return bars;
    } catch (error) {
      this.logger.error(
        `Failed to fetch daily bars for ${ticker}: ${(error as Error).message}`,
      );
      return [];
    }
  }
}
