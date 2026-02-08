import { PrismaService } from '../../../prisma/prisma.service';
export declare class StockService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(params: {
        page?: number;
        limit?: number;
        search?: string;
    }): Promise<{
        items: {
            id: string;
            ticker: string;
            name: string;
            sector: string | null;
            industry: string | null;
            exchange: string | null;
            avgVolume: bigint | null;
            marketCap: bigint | null;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
        }[];
        total: number;
        page: number;
        limit: number;
    }>;
    findByTicker(ticker: string): Promise<{
        stages: {
            id: string;
            stockId: string;
            date: Date;
            stage: import("@prisma/client").$Enums.StageEnum;
            category: import("@prisma/client").$Enums.StockCategory;
            isTemplate: boolean;
            metadata: import("@prisma/client/runtime/client").JsonValue | null;
        }[];
    } & {
        id: string;
        ticker: string;
        name: string;
        sector: string | null;
        industry: string | null;
        exchange: string | null;
        avgVolume: bigint | null;
        marketCap: bigint | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getDailyBars(ticker: string, limit?: number): Promise<{
        id: string;
        stockId: string;
        date: Date;
        open: import("@prisma/client-runtime-utils").Decimal;
        high: import("@prisma/client-runtime-utils").Decimal;
        low: import("@prisma/client-runtime-utils").Decimal;
        close: import("@prisma/client-runtime-utils").Decimal;
        volume: bigint;
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
        stockId: string;
        open: import("@prisma/client-runtime-utils").Decimal;
        high: import("@prisma/client-runtime-utils").Decimal;
        low: import("@prisma/client-runtime-utils").Decimal;
        close: import("@prisma/client-runtime-utils").Decimal;
        volume: bigint;
        ema6: import("@prisma/client-runtime-utils").Decimal | null;
        ema20: import("@prisma/client-runtime-utils").Decimal | null;
        timestamp: Date;
    }[]>;
    getStageHistory(ticker: string): Promise<{
        id: string;
        stockId: string;
        date: Date;
        stage: import("@prisma/client").$Enums.StageEnum;
        category: import("@prisma/client").$Enums.StockCategory;
        isTemplate: boolean;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
    }[]>;
}
