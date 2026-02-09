import { PrismaService } from '../../prisma/prisma.service';
export declare class WatchlistService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findByUser(userId: string): Promise<({
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
    create(userId: string, name: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        userId: string;
    }>;
    addStock(watchlistId: string, stockId: string): Promise<{
        id: string;
        stockId: string;
        watchlistId: string;
    }>;
    removeStock(watchlistId: string, stockId: string): Promise<import("@prisma/client").Prisma.BatchPayload>;
}
