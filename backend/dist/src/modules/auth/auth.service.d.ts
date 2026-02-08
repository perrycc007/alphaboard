import { PrismaService } from '../../prisma/prisma.service';
export declare class AuthService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    validateUser(email: string): Promise<{
        id: string;
        email: string;
    } | null>;
    createUser(data: {
        email: string;
        name?: string;
    }): Promise<{
        preferences: {
            id: string;
            defaultRiskPct: import("@prisma/client-runtime-utils").Decimal;
            riskProfile: import("@prisma/client").$Enums.RiskProfile;
            userId: string;
        } | null;
    } & {
        id: string;
        name: string | null;
        createdAt: Date;
        updatedAt: Date;
        email: string;
    }>;
    getUserById(id: string): Promise<{
        preferences: {
            id: string;
            defaultRiskPct: import("@prisma/client-runtime-utils").Decimal;
            riskProfile: import("@prisma/client").$Enums.RiskProfile;
            userId: string;
        } | null;
    } & {
        id: string;
        name: string | null;
        createdAt: Date;
        updatedAt: Date;
        email: string;
    }>;
}
