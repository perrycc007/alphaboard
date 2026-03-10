import { PrismaService } from '../../prisma/prisma.service';
import { SetupType, Timeframe } from '@prisma/client';
import { Bar } from '../../common/types';
import { BarContext } from './confirmation/confirmation-engine';
export declare class SetupOrchestratorService {
    private readonly prisma;
    private readonly logger;
    private readonly dailyDetectors;
    private readonly intradayDetectors;
    constructor(prisma: PrismaService);
    runDailyDetection(stockId: string, bars: Bar[]): Promise<void>;
    processIntradayBar(stockId: string, bars: Bar[], confirmContext: BarContext): Promise<void>;
    private buildDailyContext;
    private persistSetup;
    private updateDailySetupStates;
    private expireStaleSetups;
    getActiveSetups(filters?: {
        type?: SetupType;
        direction?: string;
        timeframe?: Timeframe;
    }): Promise<({
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
        id: string;
        stockId: string;
        type: import("@prisma/client").$Enums.SetupType;
        timeframe: import("@prisma/client").$Enums.Timeframe;
        direction: import("@prisma/client").$Enums.Direction;
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
            id: string;
            stockId: string;
            timeframe: import("@prisma/client").$Enums.Timeframe;
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
        id: string;
        stockId: string;
        type: import("@prisma/client").$Enums.SetupType;
        timeframe: import("@prisma/client").$Enums.Timeframe;
        direction: import("@prisma/client").$Enums.Direction;
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
    private logEvent;
    simulateDetection(ticker: string, fromDate?: Date): Promise<SimulatedSetup[]>;
}
export interface SimulatedSetup {
    id: string;
    type: SetupType;
    direction: string;
    state: string;
    detectedAt: string;
    pivotPrice: number | null;
    stopPrice: number | null;
    targetPrice: number | null;
    riskReward: number | null;
    evidence: string[];
    metadata: Record<string, unknown>;
    stateHistory: Array<{
        state: string;
        date: string;
    }>;
    tradeCategory: 'BREAKOUT' | 'REVERSAL' | null;
    entryPrice: number | null;
    entryDate: string | null;
    exitPrice: number | null;
    exitDate: string | null;
    actualStopPrice: number | null;
    riskAmount: number | null;
    maxR: number | null;
    maxPct: number | null;
    finalR: number | null;
    finalPct: number | null;
    holdingDays: number | null;
}
