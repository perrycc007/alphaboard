import { MarketService } from './market.service';
import { BreadthService } from './breadth.service';
export declare class MarketController {
    private readonly marketService;
    private readonly breadthService;
    constructor(marketService: MarketService, breadthService: BreadthService);
    getOverview(): Promise<{
        indices: {
            ticker: string;
            name: string;
            latest: {
                id: string;
                date: Date;
                open: import("@prisma/client-runtime-utils").Decimal;
                high: import("@prisma/client-runtime-utils").Decimal;
                low: import("@prisma/client-runtime-utils").Decimal;
                close: import("@prisma/client-runtime-utils").Decimal;
                volume: bigint;
                indexId: string;
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
    getBreadthTimeSeries(range?: string): Promise<{
        id: string;
        date: Date;
        naad: import("@prisma/client-runtime-utils").Decimal | null;
        naa50r: import("@prisma/client-runtime-utils").Decimal | null;
        naa200r: import("@prisma/client-runtime-utils").Decimal | null;
        nahl: import("@prisma/client-runtime-utils").Decimal | null;
        avgWeightIdx: import("@prisma/client-runtime-utils").Decimal | null;
    }[]>;
    getIndexDaily(ticker: string, range?: string): Promise<{
        id: string;
        date: Date;
        open: import("@prisma/client-runtime-utils").Decimal;
        high: import("@prisma/client-runtime-utils").Decimal;
        low: import("@prisma/client-runtime-utils").Decimal;
        close: import("@prisma/client-runtime-utils").Decimal;
        volume: bigint;
        indexId: string;
    }[]>;
}
