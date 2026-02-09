import { WatchlistService } from './watchlist.service';
export declare class WatchlistController {
    private readonly watchlistService;
    constructor(watchlistService: WatchlistService);
    findAll(userId: string): Promise<({
        items: ({
            stock: {
                id: string;
                ticker: string;
                name: string;
                sector: string | null;
                industry: string | null;
                exchange: string | null;
                avgVolume: bigint | null;
                marketCap: bigint | null;
                isCurated: boolean;
                lastSyncDate: Date | null;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
            };
        } & {
            id: string;
            stockId: string;
            watchlistId: string;
        })[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        userId: string;
    })[]>;
    create(body: {
        userId: string;
        name: string;
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        userId: string;
    }>;
    addStock(watchlistId: string, body: {
        stockId: string;
    }): Promise<{
        id: string;
        stockId: string;
        watchlistId: string;
    }>;
    removeStock(watchlistId: string, stockId: string): Promise<import("@prisma/client").Prisma.BatchPayload>;
}
