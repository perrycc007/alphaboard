import { Server, Socket } from 'socket.io';
export declare class AlertGateway {
    server: Server;
    private readonly logger;
    handleSubscribeAlerts(data: {
        userId: string;
    }, client: Socket): void;
    handleSubscribeIntraday(data: {
        ticker: string;
    }, client: Socket): void;
    sendAlert(userId: string, payload: Record<string, unknown>): void;
    sendIntradayBar(ticker: string, bar: Record<string, unknown>): void;
}
