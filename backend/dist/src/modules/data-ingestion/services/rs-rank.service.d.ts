import { PrismaService } from '../../../prisma/prisma.service';
export declare class RsRankService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    computeRanks(): Promise<number>;
    computeRsRaw(closes: number[]): number | null;
}
