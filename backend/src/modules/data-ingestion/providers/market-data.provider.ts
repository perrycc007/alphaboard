import { Bar } from '../../../common/types';

export interface DailyBarData extends Bar {
  date: Date;
}

export interface IntradayBarData extends Bar {
  timestamp: Date;
}

/**
 * Abstract interface for market data providers.
 * Implementations: YFinanceProvider (daily), PolygonProvider (intraday + real-time)
 */
export interface MarketDataProvider {
  fetchDailyBars(
    ticker: string,
    from: Date,
    to: Date,
  ): Promise<DailyBarData[]>;
}

export interface IntradayDataProvider {
  fetchIntradayBars(
    ticker: string,
    date: Date,
  ): Promise<IntradayBarData[]>;
}
