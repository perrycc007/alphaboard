import { Injectable, Logger } from '@nestjs/common';
import {
  BrokerPort,
  BrokerOrderRequest,
  BrokerOrderResult,
  BrokerPositionInfo,
} from './broker-port.interface';

interface PaperPosition {
  ticker: string;
  quantity: number;
  avgEntry: number;
  side: string;
}

interface PaperOrder {
  id: string;
  request: BrokerOrderRequest;
  status: 'SUBMITTED' | 'FILLED' | 'CANCELLED';
  filledQty: number;
  avgPrice: number;
}

/**
 * Paper Broker: simulated broker for Phase 1 paper trading.
 * All orders are immediately "filled" at the requested price.
 */
@Injectable()
export class PaperBrokerAdapter implements BrokerPort {
  readonly name = 'PaperBroker';
  private readonly logger = new Logger(PaperBrokerAdapter.name);

  private positions = new Map<string, PaperPosition>();
  private orders = new Map<string, PaperOrder>();
  private orderCounter = 0;

  async submitOrder(request: BrokerOrderRequest): Promise<BrokerOrderResult> {
    const id = `PAPER-${++this.orderCounter}`;

    // Simulate immediate fill for market orders
    const fillPrice = request.limitPrice ?? request.stopPrice ?? 0;

    const order: PaperOrder = {
      id,
      request,
      status: 'FILLED',
      filledQty: request.quantity,
      avgPrice: fillPrice,
    };

    this.orders.set(id, order);

    // Update position
    const existing = this.positions.get(request.ticker);
    if (existing) {
      const totalQty = existing.quantity + request.quantity;
      existing.avgEntry =
        (existing.avgEntry * existing.quantity +
          fillPrice * request.quantity) /
        totalQty;
      existing.quantity = totalQty;
    } else {
      this.positions.set(request.ticker, {
        ticker: request.ticker,
        quantity: request.quantity,
        avgEntry: fillPrice,
        side: request.side,
      });
    }

    this.logger.log(
      `Paper order ${id}: ${request.side} ${request.quantity} ${request.ticker} @ ${fillPrice}`,
    );

    return { brokerOrderId: id, status: 'SUBMITTED' };
  }

  async cancelOrder(brokerOrderId: string): Promise<boolean> {
    const order = this.orders.get(brokerOrderId);
    if (!order || order.status !== 'SUBMITTED') return false;
    order.status = 'CANCELLED';
    return true;
  }

  async getPositions(): Promise<BrokerPositionInfo[]> {
    return Array.from(this.positions.values()).map((p) => ({
      ticker: p.ticker,
      quantity: p.quantity,
      avgEntry: p.avgEntry,
      unrealizedPnl: 0, // Would need live price to calculate
    }));
  }

  async getOrderStatus(brokerOrderId: string) {
    const order = this.orders.get(brokerOrderId);
    if (!order) {
      return { status: 'UNKNOWN', filledQty: 0, avgPrice: 0 };
    }
    return {
      status: order.status,
      filledQty: order.filledQty,
      avgPrice: order.avgPrice,
    };
  }
}
