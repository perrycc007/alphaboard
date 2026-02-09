import { PrismaService } from '../../../prisma/prisma.service';
import { YFinanceProvider } from '../providers/yfinance.provider';
interface StockSyncTask {
    stockId: string;
    ticker: string;
    isCurated: boolean;
    from: Date;
}
export declare class BackfillService {
    private readonly prisma;
    private readonly yfinance;
    private readonly logger;
    constructor(prisma: PrismaService, yfinance: YFinanceProvider);
    getStocksNeedingSync(): Promise<StockSyncTask[]>;
    backfillAll(): Promise<{
        synced: number;
        failed: number;
    }>;
    backfillIndices(): Promise<void>;
    private syncSingleStock;
}
export {};
