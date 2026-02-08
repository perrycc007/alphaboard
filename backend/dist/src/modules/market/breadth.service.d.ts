import { PrismaService } from '../../prisma/prisma.service';
export declare class BreadthService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getLatest(): Promise<{
        id: string;
        date: Date;
        naad: import("@prisma/client-runtime-utils").Decimal | null;
        naa50r: import("@prisma/client-runtime-utils").Decimal | null;
        naa200r: import("@prisma/client-runtime-utils").Decimal | null;
        nahl: import("@prisma/client-runtime-utils").Decimal | null;
        avgWeightIdx: import("@prisma/client-runtime-utils").Decimal | null;
    } | null>;
    getTimeSeries(range?: string): Promise<{
        id: string;
        date: Date;
        naad: import("@prisma/client-runtime-utils").Decimal | null;
        naa50r: import("@prisma/client-runtime-utils").Decimal | null;
        naa200r: import("@prisma/client-runtime-utils").Decimal | null;
        nahl: import("@prisma/client-runtime-utils").Decimal | null;
        avgWeightIdx: import("@prisma/client-runtime-utils").Decimal | null;
    }[]>;
    private buildDateFilter;
}
