import { PrismaService } from '../../prisma/prisma.service';
export declare class AuthService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    findUserByEmail(email: string): Promise<{
        id: string;
        name: string | null;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        image: string | null;
    } | null>;
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
        emailVerified: boolean;
        image: string | null;
    }>;
}
