import { Injectable, Logger } from '@nestjs/common';
import { MarketDataProvider, DailyBarData } from './market-data.provider';
import YahooFinance from 'yahoo-finance2';

const FETCH_TIMEOUT_MS = 15_000; // 15 second timeout per request

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout after ${ms}ms for ${label}`)),
      ms,
    );
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * Yahoo Finance provider for historical daily OHLCV data.
 * Uses the yahoo-finance2 Node.js library to fetch bars directly.
 * Includes a 15s timeout to prevent hanging on dead tickers.
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
    try {
      const result = await withTimeout(
        this.yf.historical(ticker, {
          period1: from,
          period2: to,
          interval: '1d',
        }),
        FETCH_TIMEOUT_MS,
        ticker,
      );

      const bars: DailyBarData[] = result.map((row) => ({
        date: row.date,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
      }));

      return bars;
    } catch (error) {
      this.logger.warn(
        `Failed ${ticker}: ${(error as Error).message}`,
      );
      return [];
    }
  }
}
