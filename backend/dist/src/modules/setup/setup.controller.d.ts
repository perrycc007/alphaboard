import { SetupOrchestratorService } from './setup-orchestrator.service';
import { SetupType, Timeframe } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
type FeedbackRating = 'CORRECT' | 'FALSE_POSITIVE' | 'EARLY' | 'LATE' | 'WRONG_TYPE' | 'MISSED';
export declare class SetupController {
    private readonly orchestrator;
    private readonly prisma;
    constructor(orchestrator: SetupOrchestratorService, prisma: PrismaService);
    getActiveSetups(type?: SetupType, direction?: string, timeframe?: Timeframe): Promise<({
        stock: {
            id: string;
            name: string;
            ticker: string;
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
        };
    } & {
        type: import("@prisma/client").$Enums.SetupType;
        direction: import("@prisma/client").$Enums.Direction;
        timeframe: import("@prisma/client").$Enums.Timeframe;
        id: string;
        stockId: string;
        state: import("@prisma/client").$Enums.SetupState;
        detectedAt: Date;
        expiresAt: Date | null;
        lastStateAt: Date;
        pivotPrice: import("@prisma/client-runtime-utils").Decimal | null;
        stopPrice: import("@prisma/client-runtime-utils").Decimal | null;
        targetPrice: import("@prisma/client-runtime-utils").Decimal | null;
        riskReward: import("@prisma/client-runtime-utils").Decimal | null;
        evidence: import("@prisma/client/runtime/client").JsonValue | null;
        waitingFor: string | null;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
        dailyBaseId: string | null;
    })[]>;
    triggerScan(): Promise<{
        message: string;
    }>;
    simulateSetups(ticker: string, from?: string): Promise<import("./setup-orchestrator.service").SimulatedSetup[]>;
    getSetupById(id: string): Promise<{
        stock: {
            id: string;
            name: string;
            ticker: string;
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
        };
        barEvidence: {
            timeframe: import("@prisma/client").$Enums.Timeframe;
            id: string;
            stockId: string;
            createdAt: Date;
            barDate: Date;
            pattern: import("@prisma/client").$Enums.EvidencePattern;
            bias: import("@prisma/client").$Enums.EvidenceBias;
            isViolation: boolean;
            keyLevelType: import("@prisma/client").$Enums.KeyLevelType;
            keyLevelPrice: import("@prisma/client-runtime-utils").Decimal;
            volumeState: import("@prisma/client").$Enums.VolumeState;
            setupId: string | null;
        }[];
    } & {
        type: import("@prisma/client").$Enums.SetupType;
        direction: import("@prisma/client").$Enums.Direction;
        timeframe: import("@prisma/client").$Enums.Timeframe;
        id: string;
        stockId: string;
        state: import("@prisma/client").$Enums.SetupState;
        detectedAt: Date;
        expiresAt: Date | null;
        lastStateAt: Date;
        pivotPrice: import("@prisma/client-runtime-utils").Decimal | null;
        stopPrice: import("@prisma/client-runtime-utils").Decimal | null;
        targetPrice: import("@prisma/client-runtime-utils").Decimal | null;
        riskReward: import("@prisma/client-runtime-utils").Decimal | null;
        evidence: import("@prisma/client/runtime/client").JsonValue | null;
        waitingFor: string | null;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
        dailyBaseId: string | null;
    }>;
    getSetupEvidence(id: string): import("@prisma/client").Prisma.PrismaPromise<{
        timeframe: import("@prisma/client").$Enums.Timeframe;
        id: string;
        stockId: string;
        createdAt: Date;
        barDate: Date;
        pattern: import("@prisma/client").$Enums.EvidencePattern;
        bias: import("@prisma/client").$Enums.EvidenceBias;
        isViolation: boolean;
        keyLevelType: import("@prisma/client").$Enums.KeyLevelType;
        keyLevelPrice: import("@prisma/client-runtime-utils").Decimal;
        volumeState: import("@prisma/client").$Enums.VolumeState;
        setupId: string | null;
    }[]>;
    getSetupFeedback(id: string): Promise<Record<string, unknown>[]>;
    addSetupFeedback(id: string, body: {
        rating: FeedbackRating;
        comment?: string;
    }): Promise<{
        saved: boolean;
    }>;
    getStockEvidence(ticker: string, timeframe?: Timeframe): Promise<{
        timeframe: import("@prisma/client").$Enums.Timeframe;
        id: string;
        stockId: string;
        createdAt: Date;
        barDate: Date;
        pattern: import("@prisma/client").$Enums.EvidencePattern;
        bias: import("@prisma/client").$Enums.EvidenceBias;
        isViolation: boolean;
        keyLevelType: import("@prisma/client").$Enums.KeyLevelType;
        keyLevelPrice: import("@prisma/client-runtime-utils").Decimal;
        volumeState: import("@prisma/client").$Enums.VolumeState;
        setupId: string | null;
    }[]>;
    getEventLog(source?: string, event?: string, ticker?: string, limit?: string): Promise<Record<string, unknown>[]>;
}
export {};
