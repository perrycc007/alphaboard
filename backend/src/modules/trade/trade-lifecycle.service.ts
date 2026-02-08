import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Direction, Bias, TradeIdeaStatus } from '@prisma/client';

@Injectable()
export class TradeLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async createIdea(data: {
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
  }) {
    const riskReward =
      data.targetPrice && data.entryPrice
        ? (data.targetPrice - data.entryPrice) /
          (data.entryPrice - data.stopPrice)
        : undefined;

    return this.prisma.tradeIdea.create({
      data: {
        userId: data.userId,
        setupId: data.setupId,
        stockId: data.stockId,
        direction: data.direction,
        bias: data.bias,
        entryPrice: data.entryPrice,
        stopPrice: data.stopPrice,
        targetPrice: data.targetPrice,
        riskPercent: data.riskPercent,
        riskReward,
        notes: data.notes,
      },
    });
  }

  async listIdeas(userId?: string) {
    return this.prisma.tradeIdea.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: 'desc' },
      include: { setup: true },
    });
  }

  async confirmIdea(ideaId: string) {
    const idea = await this.prisma.tradeIdea.findUniqueOrThrow({
      where: { id: ideaId },
    });
    if (idea.status !== TradeIdeaStatus.PENDING) {
      throw new NotFoundException('Idea is not in PENDING state');
    }

    const [updatedIdea, intent] = await this.prisma.$transaction([
      this.prisma.tradeIdea.update({
        where: { id: ideaId },
        data: { status: TradeIdeaStatus.CONFIRMED },
      }),
      this.prisma.tradeIntent.create({
        data: { tradeIdeaId: ideaId },
      }),
    ]);

    return { idea: updatedIdea, intent };
  }

  async skipIdea(ideaId: string) {
    return this.prisma.tradeIdea.update({
      where: { id: ideaId },
      data: { status: TradeIdeaStatus.SKIPPED },
    });
  }

  async placeOrder(
    intentId: string,
    data: {
      type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
      side: Direction;
      quantity: number;
      limitPrice?: number;
      stopPrice?: number;
    },
  ) {
    return this.prisma.order.create({
      data: {
        intentId,
        type: data.type,
        side: data.side,
        quantity: data.quantity,
        limitPrice: data.limitPrice,
        stopPrice: data.stopPrice,
      },
    });
  }

  async listPositions(userId?: string) {
    return this.prisma.position.findMany({
      where: {
        status: 'OPEN',
        ...(userId && { userId }),
      },
      include: { executions: true },
      orderBy: { openedAt: 'desc' },
    });
  }

  async updateStop(positionId: string, newStop: number) {
    return this.prisma.position.update({
      where: { id: positionId },
      data: { currentStop: newStop },
    });
  }

  async closePosition(positionId: string) {
    return this.prisma.position.update({
      where: { id: positionId },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
  }
}
