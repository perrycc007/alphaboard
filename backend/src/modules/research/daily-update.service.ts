import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BackfillService } from '../data-ingestion/services/backfill.service';
import { FocusListService } from './focus-list.service';
import { ScanRunService } from './scan-run.service';

export interface DailyUpdateResult {
  focusListId: string | null;
  reviewed: number;
  focusToday: number;
}

interface StockSetupSnapshot {
  type: string;
  state: string;
}

/**
 * Normal trading day update. Refreshes only focus-list stocks, re-checks their
 * daily setup state, and decides `focusToday` per item. Runs under a tracked
 * FOCUS_UPDATE scan run.
 *
 * Deeper signals (group synchronization, market condition, intraday, 620
 * readiness) land in later phases; this establishes the daily loop using the
 * setup state that already exists.
 */
@Injectable()
export class DailyUpdateService {
  private readonly logger = new Logger(DailyUpdateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly focusListService: FocusListService,
    private readonly backfillService: BackfillService,
    private readonly scanRunService: ScanRunService,
  ) {}

  async run(): Promise<DailyUpdateResult> {
    return this.scanRunService.run('FOCUS_UPDATE', async (ctx) => {
      const list = await this.focusListService.getCurrent();
      if (!list || list.items.length === 0) {
        ctx.note('No active focus list to update');
        ctx.setCounts({ focusListCount: 0 });
        return { focusListId: null, reviewed: 0, focusToday: 0 };
      }

      const stockIds = list.items.map((i) => i.stockId);

      await ctx.step('refresh-bars', () =>
        this.backfillService.syncStocksByIds(stockIds),
      );

      const focusTodayCount = await ctx.step('review-items', () =>
        this.reviewItems(
          list.items.map((i) => ({ id: i.id, stockId: i.stockId })),
        ),
      );

      ctx.setCounts({ focusListCount: list.items.length });
      ctx.note(
        `focusList="${list.name}" items=${list.items.length} focusToday=${focusTodayCount}`,
      );

      return {
        focusListId: list.id,
        reviewed: list.items.length,
        focusToday: focusTodayCount,
      };
    });
  }

  /** Re-evaluate focusToday for each item from current daily setup state. */
  private async reviewItems(
    items: { id: string; stockId: string }[],
  ): Promise<number> {
    const stockIds = items.map((i) => i.stockId);

    const setups = await this.prisma.setup.findMany({
      where: {
        stockId: { in: stockIds },
        timeframe: 'DAILY',
        state: { in: ['BUILDING', 'READY', 'TRIGGERED'] },
      },
      orderBy: { detectedAt: 'desc' },
      select: { stockId: true, type: true, state: true },
    });

    const byStock = new Map<string, StockSetupSnapshot[]>();
    for (const s of setups) {
      const list = byStock.get(s.stockId);
      const snap: StockSetupSnapshot = { type: s.type, state: s.state };
      if (list) list.push(snap);
      else byStock.set(s.stockId, [snap]);
    }

    const now = new Date();
    let focusTodayCount = 0;

    for (const item of items) {
      const stockSetups = byStock.get(item.stockId) ?? [];
      const triggered = stockSetups.find((s) => s.state === 'TRIGGERED');
      const ready = stockSetups.find((s) => s.state === 'READY');

      let focusToday = false;
      let reason: string;
      const data: Prisma.FocusListItemUpdateInput = { lastReviewedAt: now };

      if (triggered) {
        focusToday = true;
        reason = `Setup triggered: ${triggered.type}`;
        data.status = 'TRIGGERED';
      } else if (ready) {
        focusToday = true;
        reason = `Setup ready: ${ready.type}`;
      } else if (stockSetups.length > 0) {
        reason = `Setup building: ${stockSetups[0].type}`;
      } else {
        reason = 'No active daily setup';
      }

      data.focusToday = focusToday;
      data.focusTodayReason = reason;
      if (focusToday) focusTodayCount++;

      await this.prisma.focusListItem.update({
        where: { id: item.id },
        data,
      });
    }

    return focusTodayCount;
  }
}
