import { PrismaService } from '../../../prisma/prisma.service';
export declare class BreadthSyncJob {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    run(): Promise<void>;
}
