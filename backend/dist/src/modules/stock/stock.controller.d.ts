import { StockService } from './services/stock.service';
import { ScreeningService } from './services/screening.service';
import { StageEnum, StockCategory } from '@prisma/client';
export declare class StockController {
    private readonly stockService;
    private readonly screeningService;
    constructor(stockService: StockService, screeningService: ScreeningService);
    findAll(page?: string, limit?: string, search?: string): Promise<{
        items: {
            id: string;
            ticker: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            sector: string | null;
            industry: string | null;
            exchange: string | null;
            avgVolume: bigint | null;
            marketCap: bigint | null;
        }[];
        total: number;
        page: number;
        limit: number;
    }>;
    screen(stage?: StageEnum, category?: StockCategory, isTemplate?: string, minRsRank?: string, sector?: string): Promise<{
        stock: {
            dailyBars: {
                id: string;
                date: Date;
                open: import("@prisma/client-runtime-utils").Decimal;
                high: import("@prisma/client-runtime-utils").Decimal;
                low: import("@prisma/client-runtime-utils").Decimal;
                close: import("@prisma/client-runtime-utils").Decimal;
                volume: bigint;
                stockId: string;
                sma20: import("@prisma/client-runtime-utils").Decimal | null;
                sma50: import("@prisma/client-runtime-utils").Decimal | null;
                sma150: import("@prisma/client-runtime-utils").Decimal | null;
                sma200: import("@prisma/client-runtime-utils").Decimal | null;
                ema6: import("@prisma/client-runtime-utils").Decimal | null;
                ema20: import("@prisma/client-runtime-utils").Decimal | null;
                rsRank: import("@prisma/client-runtime-utils").Decimal | null;
                atr14: import("@prisma/client-runtime-utils").Decimal | null;
            }[];
        } & {
            id: string;
            ticker: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            sector: string | null;
            industry: string | null;
            exchange: string | null;
            avgVolume: bigint | null;
            marketCap: bigint | null;
        };
        stage: import("@prisma/client").$Enums.StageEnum;
        category: import("@prisma/client").$Enums.StockCategory;
        isTemplate: boolean;
        latestBar: {
            id: string;
            date: Date;
            open: import("@prisma/client-runtime-utils").Decimal;
            high: import("@prisma/client-runtime-utils").Decimal;
            low: import("@prisma/client-runtime-utils").Decimal;
            close: import("@prisma/client-runtime-utils").Decimal;
            volume: bigint;
            stockId: string;
            sma20: import("@prisma/client-runtime-utils").Decimal | null;
            sma50: import("@prisma/client-runtime-utils").Decimal | null;
            sma150: import("@prisma/client-runtime-utils").Decimal | null;
            sma200: import("@prisma/client-runtime-utils").Decimal | null;
            ema6: import("@prisma/client-runtime-utils").Decimal | null;
            ema20: import("@prisma/client-runtime-utils").Decimal | null;
            rsRank: import("@prisma/client-runtime-utils").Decimal | null;
            atr14: import("@prisma/client-runtime-utils").Decimal | null;
        };
    }[]>;
    findByTicker(ticker: string): Promise<{
        stages: {
            id: string;
            date: Date;
            stockId: string;
            stage: import("@prisma/client").$Enums.StageEnum;
            category: import("@prisma/client").$Enums.StockCategory;
            isTemplate: boolean;
            metadata: import("@prisma/client/runtime/client").JsonValue | null;
        }[];
    } & {
        id: string;
        ticker: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        sector: string | null;
        industry: string | null;
        exchange: string | null;
        avgVolume: bigint | null;
        marketCap: bigint | null;
    }>;
    getDailyBars(ticker: string, limit?: string): Promise<{
        id: string;
        date: Date;
        open: import("@prisma/client-runtime-utils").Decimal;
        high: import("@prisma/client-runtime-utils").Decimal;
        low: import("@prisma/client-runtime-utils").Decimal;
        close: import("@prisma/client-runtime-utils").Decimal;
        volume: bigint;
        stockId: string;
        sma20: import("@prisma/client-runtime-utils").Decimal | null;
        sma50: import("@prisma/client-runtime-utils").Decimal | null;
        sma150: import("@prisma/client-runtime-utils").Decimal | null;
        sma200: import("@prisma/client-runtime-utils").Decimal | null;
        ema6: import("@prisma/client-runtime-utils").Decimal | null;
        ema20: import("@prisma/client-runtime-utils").Decimal | null;
        rsRank: import("@prisma/client-runtime-utils").Decimal | null;
        atr14: import("@prisma/client-runtime-utils").Decimal | null;
    }[]>;
    getIntradayBars(ticker: string): Promise<{
        id: string;
        open: import("@prisma/client-runtime-utils").Decimal;
        high: import("@prisma/client-runtime-utils").Decimal;
        low: import("@prisma/client-runtime-utils").Decimal;
        close: import("@prisma/client-runtime-utils").Decimal;
        volume: bigint;
        stockId: string;
        ema6: import("@prisma/client-runtime-utils").Decimal | null;
        ema20: import("@prisma/client-runtime-utils").Decimal | null;
        timestamp: Date;
    }[]>;
    getStageHistory(ticker: string): Promise<{
        id: string;
        date: Date;
        stockId: string;
        stage: import("@prisma/client").$Enums.StageEnum;
        category: import("@prisma/client").$Enums.StockCategory;
        isTemplate: boolean;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
    }[]>;
}
