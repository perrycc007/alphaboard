import { AuthService } from './auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    signup(body: {
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
    login(body: {
        email: string;
    }): Promise<{
        error: string;
        user?: undefined;
    } | {
        user: {
            id: string;
            email: string;
        };
        error?: undefined;
    }>;
    getUser(id: string): Promise<{
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
