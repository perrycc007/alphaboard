import { PrismaService } from '../../../prisma/prisma.service';
export declare class TickerDiscoveryService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    discoverTickers(): Promise<number>;
    private fetchSecEdgar;
    private fetchNasdaqListings;
    private fetchNyseListings;
    private parseCsv;
    private isCommonStock;
    private titleCase;
}
