import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ namespace: '/ws', cors: { origin: '*' } })
export class AlertGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AlertGateway.name);

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

  /**
   * Push alert to a specific user's room.
   */
  sendAlert(userId: string, payload: Record<string, unknown>) {
    this.server.to(`alerts:${userId}`).emit('alert', payload);
  }

  /**
   * Push intraday bar to a ticker room.
   */
  sendIntradayBar(
    ticker: string,
    bar: Record<string, unknown>,
  ) {
    this.server.to(`intraday:${ticker}`).emit('bar', { ticker, ...bar });
  }
}
