import { PrismaService } from '../../../prisma/prisma.service';
import { YFinanceProvider } from '../providers/yfinance.provider';
export declare class DailySyncJob {
    private readonly prisma;
    private readonly yfinance;
    private readonly logger;
    constructor(prisma: PrismaService, yfinance: YFinanceProvider);
    run(): Promise<void>;
}
