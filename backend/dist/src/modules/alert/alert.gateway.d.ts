import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
export declare class AlertGateway implements OnGatewayConnection, OnGatewayDisconnect {
    server: Server;
    private readonly logger;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleSubscribeAlerts(data: {
        userId: string;
    }, client: Socket): void;
    handleSubscribeIntraday(data: {
        ticker: string;
    }, client: Socket): void;
    sendAlert(userId: string, payload: Record<string, unknown>): void;
    sendIntradayBar(ticker: string, bar: Record<string, unknown>): void;
    private logInboundMessage;
}
