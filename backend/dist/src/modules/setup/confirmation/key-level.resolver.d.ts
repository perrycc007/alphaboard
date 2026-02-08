export interface KeyLevel {
    type: string;
    price: number;
    bias: 'BULLISH' | 'BEARISH';
}
interface SwingPointInput {
    type: string;
    price: number;
}
interface DailyBaseInput {
    peakPrice: number;
    baseLow: number;
    pivotPrice?: number | null;
}
interface IndicatorInput {
    sma20?: number;
    sma50?: number;
    sma200?: number;
    vwap?: number;
}
export declare function resolveKeyLevels(price: number, swingPoints: SwingPointInput[], bases: DailyBaseInput[], indicators: IndicatorInput, tolerance: number): KeyLevel[];
export {};
