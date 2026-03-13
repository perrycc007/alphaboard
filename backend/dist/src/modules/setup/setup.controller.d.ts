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
        };
    } & {
        id: string;
        stockId: string;
        type: import("@prisma/client").$Enums.SetupType;
        direction: import("@prisma/client").$Enums.Direction;
        timeframe: import("@prisma/client").$Enums.Timeframe;
        pivotPrice: import("@prisma/client-runtime-utils").Decimal | null;
        stopPrice: import("@prisma/client-runtime-utils").Decimal | null;
        targetPrice: import("@prisma/client-runtime-utils").Decimal | null;
        riskReward: import("@prisma/client-runtime-utils").Decimal | null;
        dailyBaseId: string | null;
        state: import("@prisma/client").$Enums.SetupState;
        waitingFor: string | null;
        evidence: import("@prisma/client/runtime/client").JsonValue | null;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
        detectedAt: Date;
        expiresAt: Date | null;
        lastStateAt: Date;
    })[]>;
    triggerScan(): Promise<{
        message: string;
    }>;
    simulateSetups(ticker: string, from?: string): Promise<import("./setup-orchestrator.service").SimulatedSetup[]>;
    getSetupById(id: string): Promise<{
        barEvidence: {
            id: string;
            createdAt: Date;
            stockId: string;
            timeframe: import("@prisma/client").$Enums.Timeframe;
            pattern: import("@prisma/client").$Enums.EvidencePattern;
            bias: import("@prisma/client").$Enums.EvidenceBias;
            keyLevelType: import("@prisma/client").$Enums.KeyLevelType;
            keyLevelPrice: import("@prisma/client-runtime-utils").Decimal;
            barDate: Date;
            isViolation: boolean;
            volumeState: import("@prisma/client").$Enums.VolumeState;
            setupId: string | null;
        }[];
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
        };
    } & {
        id: string;
        stockId: string;
        type: import("@prisma/client").$Enums.SetupType;
        direction: import("@prisma/client").$Enums.Direction;
        timeframe: import("@prisma/client").$Enums.Timeframe;
        pivotPrice: import("@prisma/client-runtime-utils").Decimal | null;
        stopPrice: import("@prisma/client-runtime-utils").Decimal | null;
        targetPrice: import("@prisma/client-runtime-utils").Decimal | null;
        riskReward: import("@prisma/client-runtime-utils").Decimal | null;
        dailyBaseId: string | null;
        state: import("@prisma/client").$Enums.SetupState;
        waitingFor: string | null;
        evidence: import("@prisma/client/runtime/client").JsonValue | null;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
        detectedAt: Date;
        expiresAt: Date | null;
        lastStateAt: Date;
    }>;
    getSetupEvidence(id: string): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        stockId: string;
        timeframe: import("@prisma/client").$Enums.Timeframe;
        pattern: import("@prisma/client").$Enums.EvidencePattern;
        bias: import("@prisma/client").$Enums.EvidenceBias;
        keyLevelType: import("@prisma/client").$Enums.KeyLevelType;
        keyLevelPrice: import("@prisma/client-runtime-utils").Decimal;
        barDate: Date;
        isViolation: boolean;
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
        id: string;
        createdAt: Date;
        stockId: string;
        timeframe: import("@prisma/client").$Enums.Timeframe;
        pattern: import("@prisma/client").$Enums.EvidencePattern;
        bias: import("@prisma/client").$Enums.EvidenceBias;
        keyLevelType: import("@prisma/client").$Enums.KeyLevelType;
        keyLevelPrice: import("@prisma/client-runtime-utils").Decimal;
        barDate: Date;
        isViolation: boolean;
        volumeState: import("@prisma/client").$Enums.VolumeState;
        setupId: string | null;
    }[]>;
    getEventLog(source?: string, event?: string, ticker?: string, limit?: string): Promise<Record<string, unknown>[]>;
}
export {};
