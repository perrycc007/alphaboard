import { MarketDataProvider, DailyBarData } from './market-data.provider';
export declare class YFinanceProvider implements MarketDataProvider {
    private readonly logger;
    private readonly yf;
    fetchDailyBars(ticker: string, from: Date, to: Date): Promise<DailyBarData[]>;
}
