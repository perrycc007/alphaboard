import { PrismaService } from '../../prisma/prisma.service';
export declare class ThemeService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        id: string;
        name: string;
        description: string | null;
        stats: {
            hotCount: number;
            formerHotCount: number;
            setupCount: number;
            bullishPct: number;
            bearishPct: number;
            stageDistribution: {
                stage1: number;
                stage2: number;
                stage3: number;
                stage4: number;
            };
        };
    }[]>;
    findById(id: string): Promise<{
        groups: ({
            themeStocks: ({
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
                };
            } & {
                id: string;
                stockId: string;
                groupId: string;
            })[];
        } & {
            id: string;
            name: string;
            themeId: string;
            sortOrder: number;
        })[];
    } & {
        id: string;
        name: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    create(data: {
        name: string;
        description?: string;
    }): Promise<{
        id: string;
        name: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(id: string, data: {
        name?: string;
        description?: string;
    }): Promise<{
        id: string;
        name: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    addStockToGroup(groupId: string, stockId: string): Promise<{
        id: string;
        stockId: string;
        groupId: string;
    }>;
}
