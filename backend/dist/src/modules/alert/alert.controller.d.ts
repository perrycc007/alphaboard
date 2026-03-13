import { AlertService } from './alert.service';
import { AlertType } from '@prisma/client';
export declare class AlertController {
    private readonly alertService;
    constructor(alertService: AlertService);
    findAll(userId: string): Promise<({
        stock: {
            id: string;
            ticker: string;
            name: string;
            sector: string | null;
            industry: string | null;
            exchange: string | null;
            avgVolume: bigint | null;
            marketCap: bigint | null;
            isCurated: boolean;
            lastSyncDate: Date | null;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        stockId: string | null;
        userId: string;
        type: import("@prisma/client").$Enums.AlertType;
        condition: import("@prisma/client/runtime/client").JsonValue;
        isTriggered: boolean;
        triggeredAt: Date | null;
    })[]>;
    create(body: {
        userId: string;
        stockId?: string;
        type: AlertType;
        condition: Record<string, unknown>;
    }): Promise<{
        id: string;
        createdAt: Date;
        stockId: string | null;
        userId: string;
        type: import("@prisma/client").$Enums.AlertType;
        condition: import("@prisma/client/runtime/client").JsonValue;
        isTriggered: boolean;
        triggeredAt: Date | null;
    }>;
    remove(id: string): Promise<{
        id: string;
        createdAt: Date;
        stockId: string | null;
        userId: string;
        type: import("@prisma/client").$Enums.AlertType;
        condition: import("@prisma/client/runtime/client").JsonValue;
        isTriggered: boolean;
        triggeredAt: Date | null;
    }>;
}
