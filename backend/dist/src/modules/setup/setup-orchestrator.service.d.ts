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
            ticker: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            sector: string | null;
            industry: string | null;
            exchange: string | null;
            avgVolume: bigint | null;
            marketCap: bigint | null;
        };
    } & {
        id: string;
        stockId: string;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
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
        dailyBaseId: string | null;
    })[]>;
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
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            sector: string | null;
            industry: string | null;
            exchange: string | null;
            avgVolume: bigint | null;
            marketCap: bigint | null;
        };
    } & {
        id: string;
        stockId: string;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
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
        dailyBaseId: string | null;
    }>;
}
