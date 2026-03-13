import { Injectable } from '@nestjs/common';
import {
  Direction,
  KeyLevelType,
  TimingSignalType,
  SetupType,
} from '@prisma/client';
import type { Bar } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import type { DailyDetectorContext } from './detectors/detector.interface';

@Injectable()
export class TimingSignalService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateAndPersist(
    stockId: string,
    bars: Bar[],
    context: DailyDetectorContext,
  ): Promise<number> {
    if (bars.length < 2 || !context.activeSetups?.length) return 0;

    const latest = bars[bars.length - 1];
    const prev = bars[bars.length - 2];
    const atr = context.atr14 ?? 0.5;
    let created = 0;

    const longParent = context.activeSetups.find(
      (setup) => setup.timeframe === 'DAILY' && setup.direction === 'LONG',
    );
    const shortParent = context.activeSetups.find(
      (setup) =>
        setup.timeframe === 'DAILY' &&
        setup.direction === 'SHORT' &&
        context.canShortLeader,
    );

    const cross = this.detect620Cross(bars);
    if (cross && longParent && cross.direction === 'LONG') {
      created += await this.persistSignal({
        stockId,
        parentSetupId: longParent.id,
        type: TimingSignalType.CROSS_620,
        direction: Direction.LONG,
        signalAt: latest.timestamp ?? latest.date ?? new Date(),
        levelType: KeyLevelType.VCP_PIVOT,
        referenceLevel: longParent.pivotPrice ?? latest.close,
        triggerPrice: latest.close,
        stopPrice: longParent.stopPrice,
        evidence: { source: '620_cross', prevClose: prev.close, latestClose: latest.close },
      });
    }

    if (cross && shortParent && cross.direction === 'SHORT') {
      created += await this.persistSignal({
        stockId,
        parentSetupId: shortParent.id,
        type: TimingSignalType.MACD_620_SHORT,
        direction: Direction.SHORT,
        signalAt: latest.timestamp ?? latest.date ?? new Date(),
        levelType: KeyLevelType.VCP_PIVOT,
        referenceLevel: shortParent.pivotPrice ?? latest.close,
        triggerPrice: latest.close,
        stopPrice: shortParent.stopPrice,
        evidence: { source: 'macd_620_short', prevClose: prev.close, latestClose: latest.close },
      });
    }

    if (longParent && this.detectVcpEarlyBuy(bars)) {
      created += await this.persistSignal({
        stockId,
        parentSetupId: longParent.id,
        type: TimingSignalType.VCP_EARLY_BUY,
        direction: Direction.LONG,
        signalAt: latest.timestamp ?? latest.date ?? new Date(),
        levelType: KeyLevelType.VCP_PIVOT,
        referenceLevel: longParent.pivotPrice ?? latest.high,
        triggerPrice: latest.high,
        stopPrice: longParent.stopPrice,
        evidence: { source: 'vcp_early_buy', bars: bars.slice(-5) },
      });
    }

    if (shortParent) {
      const rejection = this.detectDoubleTopRejection(
        bars,
        context.keyLevels?.filter((level) => level.bias !== 'LONG') ?? [],
        atr,
      );
      if (rejection) {
        created += await this.persistSignal({
          stockId,
          parentSetupId: shortParent.id,
          type: TimingSignalType.DOUBLE_TOP_REJECTION,
          direction: Direction.SHORT,
          signalAt: latest.timestamp ?? latest.date ?? new Date(),
          levelType: rejection.levelType,
          referenceLevel: rejection.referenceLevel,
          triggerPrice: latest.close,
          stopPrice: Math.max(prev.high, latest.high),
          evidence: rejection.evidence,
        });
      }
    }

    if (longParent) {
      const rejection = this.detectDoubleBottomRejection(
        bars,
        context.keyLevels?.filter((level) => level.bias !== 'SHORT') ?? [],
        atr,
      );
      if (rejection) {
        created += await this.persistSignal({
          stockId,
          parentSetupId: longParent.id,
          type: TimingSignalType.DOUBLE_BOTTOM_REJECTION,
          direction: Direction.LONG,
          signalAt: latest.timestamp ?? latest.date ?? new Date(),
          levelType: rejection.levelType,
          referenceLevel: rejection.referenceLevel,
          triggerPrice: latest.close,
          stopPrice: Math.min(prev.low, latest.low),
          evidence: rejection.evidence,
        });
      }
    }

    return created;
  }

  private detect620Cross(bars: Bar[]): { direction: Direction } | null {
    if (bars.length < 20) return null;
    const closes = bars.slice(-20).map((bar) => bar.close);
    const prevCloses = bars.slice(-21, -1).map((bar) => bar.close);
    if (prevCloses.length < 20) return null;

    const prevFast = this.average(prevCloses.slice(-6));
    const prevSlow = this.average(prevCloses);
    const currentFast = this.average(closes.slice(-6));
    const currentSlow = this.average(closes);

    if (prevFast <= prevSlow && currentFast > currentSlow) {
      return { direction: Direction.LONG };
    }
    if (prevFast >= prevSlow && currentFast < currentSlow) {
      return { direction: Direction.SHORT };
    }
    return null;
  }

  private detectVcpEarlyBuy(bars: Bar[]): boolean {
    if (bars.length < 6) return false;
    const recent = bars.slice(-5);
    const ranges = recent.map((bar) => bar.high - bar.low);
    const isContracting = ranges[4] <= ranges[2] && ranges[3] <= ranges[1];
    const pivot = Math.max(...recent.slice(0, 4).map((bar) => bar.high));
    return isContracting && recent[4].close > pivot;
  }

  private detectDoubleTopRejection(
    bars: Bar[],
    levels: Array<{ type: KeyLevelType; price: number }>,
    atr: number,
  ) {
    if (bars.length < 2 || levels.length === 0) return null;
    const lastTwo = bars.slice(-2);

    for (const level of levels) {
      const tolerance = Math.max(atr * 0.25, level.price * 0.002);
      const hitsLevel = lastTwo.every((bar) => bar.high >= level.price - tolerance);
      const upperWickBars = lastTwo.every((bar) => this.upperWick(bar) > this.bodySize(bar));
      const closesBelow = lastTwo.every((bar) => bar.close <= level.price + tolerance / 2);

      if (hitsLevel && upperWickBars && closesBelow) {
        return {
          levelType: level.type,
          referenceLevel: level.price,
          evidence: {
            source: 'double_top_rejection',
            bars: lastTwo,
            level,
          },
        };
      }
    }

    return null;
  }

  private detectDoubleBottomRejection(
    bars: Bar[],
    levels: Array<{ type: KeyLevelType; price: number }>,
    atr: number,
  ) {
    if (bars.length < 2 || levels.length === 0) return null;
    const lastTwo = bars.slice(-2);

    for (const level of levels) {
      const tolerance = Math.max(atr * 0.25, level.price * 0.002);
      const hitsLevel = lastTwo.every((bar) => bar.low <= level.price + tolerance);
      const lowerWickBars = lastTwo.every((bar) => this.lowerWick(bar) > this.bodySize(bar));
      const closesAbove = lastTwo.every((bar) => bar.close >= level.price - tolerance / 2);

      if (hitsLevel && lowerWickBars && closesAbove) {
        return {
          levelType: level.type,
          referenceLevel: level.price,
          evidence: {
            source: 'double_bottom_rejection',
            bars: lastTwo,
            level,
          },
        };
      }
    }

    return null;
  }

  private async persistSignal(input: {
    stockId: string;
    parentSetupId: string;
    type: TimingSignalType;
    direction: Direction;
    signalAt: Date;
    levelType: KeyLevelType;
    referenceLevel: number;
    triggerPrice?: number;
    stopPrice?: number;
    evidence?: Record<string, unknown>;
  }): Promise<number> {
    const existing = await this.prisma.intradayTimingSignal.findFirst({
      where: {
        parentSetupId: input.parentSetupId,
        type: input.type,
        signalAt: input.signalAt,
      },
    });

    if (existing) return 0;

    await this.prisma.intradayTimingSignal.create({
      data: {
        stockId: input.stockId,
        parentSetupId: input.parentSetupId,
        type: input.type,
        direction: input.direction,
        signalAt: input.signalAt,
        levelType: input.levelType,
        referenceLevel: input.referenceLevel,
        triggerPrice: input.triggerPrice,
        stopPrice: input.stopPrice,
        evidence: (input.evidence ?? {}) as any,
      },
    });
    return 1;
  }

  private average(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private bodySize(bar: Bar): number {
    return Math.abs(bar.close - bar.open);
  }

  private upperWick(bar: Bar): number {
    return bar.high - Math.max(bar.open, bar.close);
  }

  private lowerWick(bar: Bar): number {
    return Math.min(bar.open, bar.close) - bar.low;
  }
}
