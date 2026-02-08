import { BrokerPort, BrokerOrderRequest, BrokerOrderResult, BrokerPositionInfo } from './broker-port.interface';
export declare class PaperBrokerAdapter implements BrokerPort {
    readonly name = "PaperBroker";
    private readonly logger;
    private positions;
    private orders;
    private orderCounter;
    submitOrder(request: BrokerOrderRequest): Promise<BrokerOrderResult>;
    cancelOrder(brokerOrderId: string): Promise<boolean>;
    getPositions(): Promise<BrokerPositionInfo[]>;
    getOrderStatus(brokerOrderId: string): Promise<{
        status: string;
        filledQty: number;
        avgPrice: number;
    }>;
}
