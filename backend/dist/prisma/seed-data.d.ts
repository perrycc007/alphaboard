export interface StockEntry {
    ticker: string;
    name: string;
    sector: string;
    industry: string;
    exchange: 'NASDAQ' | 'NYSE' | 'AMEX';
}
export declare const stocks: StockEntry[];
export interface ThemeEntry {
    name: string;
    description: string;
    groups: {
        name: string;
        tickers: string[];
    }[];
}
export declare const themes: ThemeEntry[];
