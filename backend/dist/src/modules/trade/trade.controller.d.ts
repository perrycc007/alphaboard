import { TradeLifecycleService } from './trade-lifecycle.service';
import { Direction, Bias } from '@prisma/client';
export declare class TradeController {
    private readonly tradeService;
    constructor(tradeService: TradeLifecycleService);
    createIdea(body: {
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
        direction: import("@prisma/client").$Enums.Direction;
        stopPrice: import("@prisma/client-runtime-utils").Decimal;
        targetPrice: import("@prisma/client-runtime-utils").Decimal | null;
        riskReward: import("@prisma/client-runtime-utils").Decimal | null;
        bias: import("@prisma/client").$Enums.Bias;
        setupId: string | null;
        status: import("@prisma/client").$Enums.TradeIdeaStatus;
        entryPrice: import("@prisma/client-runtime-utils").Decimal | null;
        riskPercent: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
    }>;
    listIdeas(): Promise<({
        setup: {
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
        } | null;
    } & {
        id: string;
        createdAt: Date;
        stockId: string;
        userId: string | null;
        direction: import("@prisma/client").$Enums.Direction;
        stopPrice: import("@prisma/client-runtime-utils").Decimal;
        targetPrice: import("@prisma/client-runtime-utils").Decimal | null;
        riskReward: import("@prisma/client-runtime-utils").Decimal | null;
        bias: import("@prisma/client").$Enums.Bias;
        setupId: string | null;
        status: import("@prisma/client").$Enums.TradeIdeaStatus;
        entryPrice: import("@prisma/client-runtime-utils").Decimal | null;
        riskPercent: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
    })[]>;
    confirmIdea(id: string): Promise<{
        idea: {
            id: string;
            createdAt: Date;
            stockId: string;
            userId: string | null;
            direction: import("@prisma/client").$Enums.Direction;
            stopPrice: import("@prisma/client-runtime-utils").Decimal;
            targetPrice: import("@prisma/client-runtime-utils").Decimal | null;
            riskReward: import("@prisma/client-runtime-utils").Decimal | null;
            bias: import("@prisma/client").$Enums.Bias;
            setupId: string | null;
            status: import("@prisma/client").$Enums.TradeIdeaStatus;
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
    skipIdea(id: string): Promise<{
        id: string;
        createdAt: Date;
        stockId: string;
        userId: string | null;
        direction: import("@prisma/client").$Enums.Direction;
        stopPrice: import("@prisma/client-runtime-utils").Decimal;
        targetPrice: import("@prisma/client-runtime-utils").Decimal | null;
        riskReward: import("@prisma/client-runtime-utils").Decimal | null;
        bias: import("@prisma/client").$Enums.Bias;
        setupId: string | null;
        status: import("@prisma/client").$Enums.TradeIdeaStatus;
        entryPrice: import("@prisma/client-runtime-utils").Decimal | null;
        riskPercent: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
    }>;
    placeOrder(intentId: string, body: {
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
        stopPrice: import("@prisma/client-runtime-utils").Decimal | null;
        status: import("@prisma/client").$Enums.OrderStatus;
        brokerOrderId: string | null;
        side: import("@prisma/client").$Enums.Direction;
        quantity: import("@prisma/client-runtime-utils").Decimal;
        limitPrice: import("@prisma/client-runtime-utils").Decimal | null;
        intentId: string;
    }>;
    listPositions(): Promise<({
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
        direction: import("@prisma/client").$Enums.Direction;
        status: import("@prisma/client").$Enums.PositionStatus;
        quantity: import("@prisma/client-runtime-utils").Decimal;
        avgEntry: import("@prisma/client-runtime-utils").Decimal;
        currentStop: import("@prisma/client-runtime-utils").Decimal | null;
        realizedPnl: import("@prisma/client-runtime-utils").Decimal;
        unrealizedPnl: import("@prisma/client-runtime-utils").Decimal;
        openedAt: Date;
        closedAt: Date | null;
    })[]>;
    updateStop(id: string, body: {
        stopPrice: number;
    }): Promise<{
        id: string;
        ticker: string;
        userId: string | null;
        direction: import("@prisma/client").$Enums.Direction;
        status: import("@prisma/client").$Enums.PositionStatus;
        quantity: import("@prisma/client-runtime-utils").Decimal;
        avgEntry: import("@prisma/client-runtime-utils").Decimal;
        currentStop: import("@prisma/client-runtime-utils").Decimal | null;
        realizedPnl: import("@prisma/client-runtime-utils").Decimal;
        unrealizedPnl: import("@prisma/client-runtime-utils").Decimal;
        openedAt: Date;
        closedAt: Date | null;
    }>;
    closePosition(id: string): Promise<{
        id: string;
        ticker: string;
        userId: string | null;
        direction: import("@prisma/client").$Enums.Direction;
        status: import("@prisma/client").$Enums.PositionStatus;
        quantity: import("@prisma/client-runtime-utils").Decimal;
        avgEntry: import("@prisma/client-runtime-utils").Decimal;
        currentStop: import("@prisma/client-runtime-utils").Decimal | null;
        realizedPnl: import("@prisma/client-runtime-utils").Decimal;
        unrealizedPnl: import("@prisma/client-runtime-utils").Decimal;
        openedAt: Date;
        closedAt: Date | null;
    }>;
}
