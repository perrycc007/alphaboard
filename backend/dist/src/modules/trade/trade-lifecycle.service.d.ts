import { PrismaService } from '../../prisma/prisma.service';
import { Direction, Bias } from '@prisma/client';
export declare class TradeLifecycleService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createIdea(data: {
        userId?: string;
        setupId?: string;
        stockId: string;
        direction: Direction;
        bias: Bias;
        entryPrice?: number;
        stopPrice: number;
        targetPrice?: number;
        riskPercent: number;
        notes?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        stockId: string;
        userId: string | null;
        status: import("@prisma/client").$Enums.TradeIdeaStatus;
        bias: import("@prisma/client").$Enums.Bias;
        direction: import("@prisma/client").$Enums.Direction;
        stopPrice: import("@prisma/client-runtime-utils").Decimal;
        riskReward: import("@prisma/client-runtime-utils").Decimal | null;
        targetPrice: import("@prisma/client-runtime-utils").Decimal | null;
        setupId: string | null;
        entryPrice: import("@prisma/client-runtime-utils").Decimal | null;
        riskPercent: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
    }>;
    listIdeas(userId?: string): Promise<({
        setup: {
            id: string;
            stockId: string;
            type: import("@prisma/client").$Enums.SetupType;
            metadata: import("@prisma/client/runtime/client").JsonValue | null;
            pivotPrice: import("@prisma/client-runtime-utils").Decimal | null;
            direction: import("@prisma/client").$Enums.Direction;
            timeframe: import("@prisma/client").$Enums.Timeframe;
            stopPrice: import("@prisma/client-runtime-utils").Decimal | null;
            riskReward: import("@prisma/client-runtime-utils").Decimal | null;
            targetPrice: import("@prisma/client-runtime-utils").Decimal | null;
            dailyBaseId: string | null;
            waitingFor: string | null;
            evidence: import("@prisma/client/runtime/client").JsonValue | null;
            detectedAt: Date;
            state: import("@prisma/client").$Enums.SetupState;
            expiresAt: Date | null;
            lastStateAt: Date;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        stockId: string;
        userId: string | null;
        status: import("@prisma/client").$Enums.TradeIdeaStatus;
        bias: import("@prisma/client").$Enums.Bias;
        direction: import("@prisma/client").$Enums.Direction;
        stopPrice: import("@prisma/client-runtime-utils").Decimal;
        riskReward: import("@prisma/client-runtime-utils").Decimal | null;
        targetPrice: import("@prisma/client-runtime-utils").Decimal | null;
        setupId: string | null;
        entryPrice: import("@prisma/client-runtime-utils").Decimal | null;
        riskPercent: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
    })[]>;
    confirmIdea(ideaId: string): Promise<{
        idea: {
            id: string;
            createdAt: Date;
            stockId: string;
            userId: string | null;
            status: import("@prisma/client").$Enums.TradeIdeaStatus;
            bias: import("@prisma/client").$Enums.Bias;
            direction: import("@prisma/client").$Enums.Direction;
            stopPrice: import("@prisma/client-runtime-utils").Decimal;
            riskReward: import("@prisma/client-runtime-utils").Decimal | null;
            targetPrice: import("@prisma/client-runtime-utils").Decimal | null;
            setupId: string | null;
            entryPrice: import("@prisma/client-runtime-utils").Decimal | null;
            riskPercent: import("@prisma/client-runtime-utils").Decimal;
            notes: string | null;
        };
        intent: {
            id: string;
            tradeIdeaId: string;
            confirmedAt: Date;
        };
    }>;
    skipIdea(ideaId: string): Promise<{
        id: string;
        createdAt: Date;
        stockId: string;
        userId: string | null;
        status: import("@prisma/client").$Enums.TradeIdeaStatus;
        bias: import("@prisma/client").$Enums.Bias;
        direction: import("@prisma/client").$Enums.Direction;
        stopPrice: import("@prisma/client-runtime-utils").Decimal;
        riskReward: import("@prisma/client-runtime-utils").Decimal | null;
        targetPrice: import("@prisma/client-runtime-utils").Decimal | null;
        setupId: string | null;
        entryPrice: import("@prisma/client-runtime-utils").Decimal | null;
        riskPercent: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
    }>;
    placeOrder(intentId: string, data: {
        type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
        side: Direction;
        quantity: number;
        limitPrice?: number;
        stopPrice?: number;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        type: import("@prisma/client").$Enums.OrderType;
        brokerOrderId: string | null;
        status: import("@prisma/client").$Enums.OrderStatus;
        stopPrice: import("@prisma/client-runtime-utils").Decimal | null;
        side: import("@prisma/client").$Enums.Direction;
        quantity: import("@prisma/client-runtime-utils").Decimal;
        limitPrice: import("@prisma/client-runtime-utils").Decimal | null;
        intentId: string;
    }>;
    listPositions(userId?: string): Promise<({
        executions: {
            id: string;
            quantity: import("@prisma/client-runtime-utils").Decimal;
            orderId: string;
            price: import("@prisma/client-runtime-utils").Decimal;
            fee: import("@prisma/client-runtime-utils").Decimal | null;
            executedAt: Date;
            positionId: string | null;
        }[];
    } & {
        id: string;
        ticker: string;
        userId: string | null;
        status: import("@prisma/client").$Enums.PositionStatus;
        direction: import("@prisma/client").$Enums.Direction;
        quantity: import("@prisma/client-runtime-utils").Decimal;
        avgEntry: import("@prisma/client-runtime-utils").Decimal;
        currentStop: import("@prisma/client-runtime-utils").Decimal | null;
        realizedPnl: import("@prisma/client-runtime-utils").Decimal;
        unrealizedPnl: import("@prisma/client-runtime-utils").Decimal;
        openedAt: Date;
        closedAt: Date | null;
    })[]>;
    updateStop(positionId: string, newStop: number): Promise<{
        id: string;
        ticker: string;
        userId: string | null;
        status: import("@prisma/client").$Enums.PositionStatus;
        direction: import("@prisma/client").$Enums.Direction;
        quantity: import("@prisma/client-runtime-utils").Decimal;
        avgEntry: import("@prisma/client-runtime-utils").Decimal;
        currentStop: import("@prisma/client-runtime-utils").Decimal | null;
        realizedPnl: import("@prisma/client-runtime-utils").Decimal;
        unrealizedPnl: import("@prisma/client-runtime-utils").Decimal;
        openedAt: Date;
        closedAt: Date | null;
    }>;
    closePosition(positionId: string): Promise<{
        id: string;
        ticker: string;
        userId: string | null;
        status: import("@prisma/client").$Enums.PositionStatus;
        direction: import("@prisma/client").$Enums.Direction;
        quantity: import("@prisma/client-runtime-utils").Decimal;
        avgEntry: import("@prisma/client-runtime-utils").Decimal;
        currentStop: import("@prisma/client-runtime-utils").Decimal | null;
        realizedPnl: import("@prisma/client-runtime-utils").Decimal;
        unrealizedPnl: import("@prisma/client-runtime-utils").Decimal;
        openedAt: Date;
        closedAt: Date | null;
    }>;
}
