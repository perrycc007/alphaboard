import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertType } from '@prisma/client';
import { AlertGateway } from './alert.gateway';
import { appendJsonLog } from '../../common/utils/file-log.util';

@Injectable()
export class AlertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertGateway: AlertGateway,
  ) {}

  async findByUser(userId: string) {
    return this.prisma.alert.findMany({
      where: { userId },
      include: { stock: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    userId: string;
    stockId?: string;
    type: AlertType;
    condition: Record<string, unknown>;
  }) {
    return this.prisma.alert.create({
      data: {
        userId: data.userId,
        stockId: data.stockId,
        type: data.type,
        condition: data.condition as any,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.alert.delete({ where: { id } });
  }

  async triggerAlert(
    alertId: string,
    payload: Record<string, unknown>,
  ) {
    const alert = await this.prisma.alert.update({
      where: { id: alertId },
      data: { isTriggered: true, triggeredAt: new Date() },
      include: { stock: true },
    });

    this.alertGateway.sendAlert(alert.userId, {
      alertId: alert.id,
      type: alert.type,
      ticker: alert.stock?.ticker,
      payload,
      triggeredAt: alert.triggeredAt,
    });

    try {
      await appendJsonLog('detector-events.json', {
        source: 'alert_service',
        event: 'alert_triggered',
        ticker: alert.stock?.ticker ?? null,
        setupType: null,
        payload: {
          alertId: alert.id,
          alertType: alert.type,
          userId: alert.userId,
          condition: alert.condition,
          ...payload,
        },
      });
    } catch {
      // non-critical: swallow log failures
    }

    return alert;
  }
}
