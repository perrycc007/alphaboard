import { Injectable, Logger } from '@nestjs/common';
import { DailyBarData, IntradayBarData } from './market-data.provider';
import { MarketDataRouter, ProviderSource } from './provider.types';
import { YFinanceProvider } from './yfinance.provider';
import { PolygonProvider } from './polygon.provider';

/**
 * Routes market data requests to the appropriate provider.
 *
 * Active routing today:
 * - daily bars    -> yfinance
 * - intraday bars -> polygon (when configured)
 *
 * Keeping this layer in place means future providers (EODHD, Alpaca, etc.)
 * and fallback behavior can be added here without changing callers.
 */
@Injectable()
export class MarketDataRouterService implements MarketDataRouter {
  private readonly logger = new Logger(MarketDataRouterService.name);

  constructor(
    private readonly yfinance: YFinanceProvider,
    private readonly polygon: PolygonProvider,
  ) {}

  async fetchDailyBars(
    ticker: string,
    from: Date,
    to: Date,
  ): Promise<DailyBarData[]> {
    const source: ProviderSource = 'yfinance';
    const bars = await this.yfinance.fetchDailyBars(ticker, from, to);
    this.logger.debug(
      `[${source}] daily ${ticker}: ${bars.length} bars`,
    );
    return bars;
  }

  async fetchIntradayBars(
    ticker: string,
    date: Date,
  ): Promise<IntradayBarData[]> {
    const source: ProviderSource = 'polygon';
    if (!this.polygon.isConfigured()) {
      this.logger.warn(
        `[${source}] not configured; no intraday bars for ${ticker}`,
      );
      return [];
    }
    const bars = await this.polygon.fetchIntradayBars(ticker, date);
    this.logger.debug(
      `[${source}] intraday ${ticker}: ${bars.length} bars`,
    );
    return bars;
  }
}
