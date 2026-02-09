import { PrismaService } from '../../prisma/prisma.service';
import { AlertType } from '@prisma/client';
import { AlertGateway } from './alert.gateway';
export declare class AlertService {
    private readonly prisma;
    private readonly alertGateway;
    constructor(prisma: PrismaService, alertGateway: AlertGateway);
    findByUser(userId: string): Promise<({
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
    create(data: {
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
    triggerAlert(alertId: string, payload: Record<string, unknown>): Promise<{
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
    }>;
}
