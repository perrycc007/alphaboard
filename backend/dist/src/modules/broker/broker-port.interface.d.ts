import { Direction } from '@prisma/client';
export interface BrokerOrderRequest {
    ticker: string;
    side: Direction;
    quantity: number;
    type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
    limitPrice?: number;
    stopPrice?: number;
}
export interface BrokerOrderResult {
    brokerOrderId: string;
    status: 'SUBMITTED' | 'REJECTED';
    message?: string;
}
export interface BrokerPositionInfo {
    ticker: string;
    quantity: number;
    avgEntry: number;
    unrealizedPnl: number;
}
export interface BrokerPort {
    readonly name: string;
    submitOrder(request: BrokerOrderRequest): Promise<BrokerOrderResult>;
    cancelOrder(brokerOrderId: string): Promise<boolean>;
    getPositions(): Promise<BrokerPositionInfo[]>;
    getOrderStatus(brokerOrderId: string): Promise<{
        status: string;
        filledQty: number;
        avgPrice: number;
    }>;
}
