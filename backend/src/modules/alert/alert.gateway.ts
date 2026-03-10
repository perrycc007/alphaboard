import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { appendJsonLog } from '../../common/utils/file-log.util';

@WebSocketGateway({ namespace: '/ws', cors: { origin: '*' } })
export class AlertGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AlertGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`[WS DEBUG] Client connected: ${client.id}`);
    client.onAny((event: string, ...args: unknown[]) => {
      this.logger.log(
        `[WS DEBUG] inbound event="${event}" client=${client.id} payload=${JSON.stringify(args)}`,
      );
      this.logInboundMessage(client.id, event, args).catch((err) => {
        this.logger.error(
          `[WS DEBUG] failed to persist inbound event="${event}" client=${client.id}: ${String(err)}`,
        );
      });
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[WS DEBUG] Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:alerts')
  handleSubscribeAlerts(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`alerts:${data.userId}`);
    this.logger.log(`Client ${client.id} subscribed to alerts for ${data.userId}`);
  }

  @SubscribeMessage('subscribe:intraday')
  handleSubscribeIntraday(
    @MessageBody() data: { ticker: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`intraday:${data.ticker}`);
    this.logger.log(`Client ${client.id} subscribed to intraday ${data.ticker}`);
  }

  sendAlert(userId: string, payload: Record<string, unknown>) {
    this.server.to(`alerts:${userId}`).emit('alert', payload);
  }

  sendIntradayBar(
    ticker: string,
    bar: Record<string, unknown>,
  ) {
    this.server.to(`intraday:${ticker}`).emit('bar', { ticker, ...bar });
  }

  private async logInboundMessage(
    clientId: string,
    event: string,
    args: unknown[],
  ): Promise<void> {
    const payload = args.length === 1 ? args[0] : args;
    const data = typeof payload === 'object' && payload !== null
      ? (payload as Record<string, unknown>)
      : { raw: payload };

    await appendJsonLog('inbound-messages.json', {
      source: 'websocket',
      event: `ws:${event}`,
      ticker: (data.ticker as string) ?? null,
      setupType: null,
      payload: { clientId, ...data },
    });
  }
}
