import { DailyBarData, IntradayBarData } from './market-data.provider';

/** Identifies which upstream provider served a request. */
export type ProviderSource = 'yfinance' | 'polygon';

/**
 * Single entry point for market data, decoupling callers from concrete
 * providers. yfinance is the only active source today; EODHD, Polygon,
 * Alpaca, etc. can be routed here later without touching call sites.
 */
export interface MarketDataRouter {
  fetchDailyBars(ticker: string, from: Date, to: Date): Promise<DailyBarData[]>;
  fetchIntradayBars?(ticker: string, date: Date): Promise<IntradayBarData[]>;
}
