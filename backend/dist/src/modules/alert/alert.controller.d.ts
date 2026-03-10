import { AlertService } from './alert.service';
import { AlertType } from '@prisma/client';
export declare class AlertController {
    private readonly alertService;
    constructor(alertService: AlertService);
    findAll(userId: string): Promise<({
        stock: {
            ticker: string;
            id: string;
            createdAt: Date;
            name: string;
            sector: string | null;
            industry: string | null;
            exchange: string | null;
            avgVolume: bigint | null;
            marketCap: bigint | null;
            isCurated: boolean;
            lastSyncDate: Date | null;
            isActive: boolean;
            updatedAt: Date;
        } | null;
    } & {
        id: string;
        userId: string;
        stockId: string | null;
        type: import("@prisma/client").$Enums.AlertType;
        condition: import("@prisma/client/runtime/client").JsonValue;
        isTriggered: boolean;
        triggeredAt: Date | null;
        createdAt: Date;
    })[]>;
    create(body: {
        userId: string;
        stockId?: string;
        type: AlertType;
        condition: Record<string, unknown>;
    }): Promise<{
        id: string;
        userId: string;
        stockId: string | null;
        type: import("@prisma/client").$Enums.AlertType;
        condition: import("@prisma/client/runtime/client").JsonValue;
        isTriggered: boolean;
        triggeredAt: Date | null;
        createdAt: Date;
    }>;
    remove(id: string): Promise<{
        id: string;
        userId: string;
        stockId: string | null;
        type: import("@prisma/client").$Enums.AlertType;
        condition: import("@prisma/client/runtime/client").JsonValue;
        isTriggered: boolean;
        triggeredAt: Date | null;
        createdAt: Date;
    }>;
}
