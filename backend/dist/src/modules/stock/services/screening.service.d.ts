import { PrismaService } from '../../../prisma/prisma.service';
import { StageEnum, StockCategory } from '@prisma/client';
export interface ScreeningFilter {
    stage?: StageEnum;
    category?: StockCategory;
    isTemplate?: boolean;
    minRsRank?: number;
    sector?: string;
}
export declare class ScreeningService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    screen(filter: ScreeningFilter): Promise<{
        stock: {
            dailyBars: {
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
        };
        stage: import("@prisma/client").$Enums.StageEnum;
        category: import("@prisma/client").$Enums.StockCategory;
        isTemplate: boolean;
        latestBar: {
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
        };
    }[]>;
}
