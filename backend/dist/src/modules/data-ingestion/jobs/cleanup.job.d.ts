import { PrismaService } from '../../../prisma/prisma.service';
export declare class CleanupJob {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    run(): Promise<void>;
}
