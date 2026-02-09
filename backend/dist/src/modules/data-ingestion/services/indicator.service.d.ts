import { PrismaService } from '../../../prisma/prisma.service';
interface IndicatorRow {
    index: number;
    sma20: number | null;
    sma50: number | null;
    sma150: number | null;
    sma200: number | null;
    ema6: number | null;
    ema20: number | null;
    atr14: number | null;
}
export declare class IndicatorService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    computeSMA(values: number[], period: number): (number | null)[];
    computeEMA(values: number[], period: number): (number | null)[];
    computeATR14(highs: number[], lows: number[], closes: number[]): (number | null)[];
    computeAllIndicators(closes: number[], highs: number[], lows: number[]): IndicatorRow[];
    updateIndicatorsForStock(stockId: string): Promise<number>;
    computeAllStocks(): Promise<{
        processed: number;
        updated: number;
    }>;
}
export {};
