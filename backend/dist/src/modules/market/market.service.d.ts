import { PrismaService } from '../../prisma/prisma.service';
import { BreadthService } from './breadth.service';
export declare class MarketService {
    private readonly prisma;
    private readonly breadthService;
    private readonly logger;
    constructor(prisma: PrismaService, breadthService: BreadthService);
    getOverview(): Promise<{
        indices: {
            ticker: string;
            name: string;
            latest: {
                id: string;
                date: Date;
                indexId: string;
                open: import("@prisma/client-runtime-utils").Decimal;
                high: import("@prisma/client-runtime-utils").Decimal;
                low: import("@prisma/client-runtime-utils").Decimal;
                close: import("@prisma/client-runtime-utils").Decimal;
                volume: bigint;
            };
        }[];
        breadth: {
            id: string;
            date: Date;
            naad: import("@prisma/client-runtime-utils").Decimal | null;
            naa50r: import("@prisma/client-runtime-utils").Decimal | null;
            naa200r: import("@prisma/client-runtime-utils").Decimal | null;
            nahl: import("@prisma/client-runtime-utils").Decimal | null;
            avgWeightIdx: import("@prisma/client-runtime-utils").Decimal | null;
        } | null;
        timestamp: string;
    }>;
    getIndicesWithLatest(): Promise<{
        ticker: string;
        name: string;
        latest: {
            id: string;
            date: Date;
            indexId: string;
            open: import("@prisma/client-runtime-utils").Decimal;
            high: import("@prisma/client-runtime-utils").Decimal;
            low: import("@prisma/client-runtime-utils").Decimal;
            close: import("@prisma/client-runtime-utils").Decimal;
            volume: bigint;
        };
    }[]>;
    getIndexDaily(ticker: string, range?: string): Promise<{
        id: string;
        date: Date;
        indexId: string;
        open: import("@prisma/client-runtime-utils").Decimal;
        high: import("@prisma/client-runtime-utils").Decimal;
        low: import("@prisma/client-runtime-utils").Decimal;
        close: import("@prisma/client-runtime-utils").Decimal;
        volume: bigint;
    }[]>;
    private buildDateFilter;
}
