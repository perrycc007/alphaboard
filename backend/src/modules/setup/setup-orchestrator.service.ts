import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SetupState, SetupType, Timeframe } from '@prisma/client';
import { Bar } from '../../common/types';
import { detectSwingPoints, averageBarSize } from './primitives';
import {
  DailyDetector,
  DailyDetectorContext,
  DetectedSetup,
} from './detectors/detector.interface';
import { DailyBaseDetector } from './detectors/daily/daily-base.detector';
import { VcpDetector } from './detectors/daily/vcp.detector';
import { BreakoutDetector } from './detectors/daily/breakout.detector';
import { FailBreakoutDetector } from './detectors/daily/fail-breakout.detector';
import { FailBaseDetector } from './detectors/daily/fail-base.detector';
import { HighTightFlagDetector } from './detectors/daily/high-tight-flag.detector';
import { PullbackDetector } from './detectors/daily/pullback.detector';
import { UndercutRallyDetector } from './detectors/daily/undercut-rally.detector';
import { DoubleTopDetector } from './detectors/daily/double-top.detector';
import { IntradayBaseDetector } from './detectors/intraday/intraday-base.detector';
import { Cross620Detector } from './detectors/intraday/cross620.detector';
import { GapDetector } from './detectors/intraday/gap.detector';
import { TiringDownDetector } from './detectors/intraday/tiring-down.detector';
import {
  evaluateBar as evaluateConfirmation,
  BarContext,
} from './confirmation/confirmation-engine';

@Injectable()
export class SetupOrchestratorService {
  private readonly logger = new Logger(SetupOrchestratorService.name);

  private readonly dailyDetectors: DailyDetector[] = [
    new DailyBaseDetector(),
    new VcpDetector(),
    new BreakoutDetector(),
    new FailBreakoutDetector(),
    new FailBaseDetector(),
    new HighTightFlagDetector(),
    new PullbackDetector(),
    new UndercutRallyDetector(),
    new DoubleTopDetector(),
  ];

  private readonly intradayDetectors = [
    new IntradayBaseDetector(),
    new Cross620Detector(),
    new GapDetector(),
    new TiringDownDetector(),
  ];

  constructor(private readonly prisma: PrismaService) {}

  async runDailyDetection(stockId: string, bars: Bar[]): Promise<void> {
    const swingPoints = detectSwingPoints(bars);
    const context = await this.buildDailyContext(stockId, bars);

    for (const detector of this.dailyDetectors) {
      const result = detector.detect(bars, swingPoints, context);
      if (result) {
        await this.persistSetup(stockId, result);
        this.logger.log(`Detected ${result.type} for stock ${stockId}`);
      }
    }

    await this.updateDailySetupStates(stockId, bars);
    await this.expireStaleSetups(stockId);
  }

  async processIntradayBar(
    stockId: string,
    bars: Bar[],
    confirmContext: BarContext,
  ): Promise<void> {
    const context = await this.buildDailyContext(stockId, bars);

    for (const detector of this.intradayDetectors) {
      const result = detector.detect(bars, context);
      if (result) {
        await this.persistSetup(stockId, result);
      }
    }

    if (bars.length >= 2) {
      const evidenceResults = evaluateConfirmation(
        bars[bars.length - 1],
        bars[bars.length - 2],
        confirmContext,
      );

      for (const ev of evidenceResults) {
        await this.prisma.barEvidence.create({
          data: {
            stockId,
            timeframe: Timeframe.INTRADAY,
            barDate: new Date(),
            pattern: ev.pattern as any,
            bias: ev.bias as any,
            isViolation: ev.isViolation,
            keyLevelType: ev.keyLevelType as any,
            keyLevelPrice: ev.keyLevelPrice,
            volumeState: ev.volumeState as any,
          },
        });
      }
    }
  }

  private async buildDailyContext(
    stockId: string,
    bars: Bar[],
  ): Promise<DailyDetectorContext> {
    const latestStage = await this.prisma.stockStage.findFirst({
      where: { stockId },
      orderBy: { date: 'desc' },
    });

    const activeBases = await this.prisma.dailyBase.findMany({
      where: { stockId, status: { in: ['FORMING', 'COMPLETE'] } },
    });

    const activeSetups = await this.prisma.setup.findMany({
      where: {
        stockId,
        state: {
          in: [
            SetupState.BUILDING,
            SetupState.READY,
            SetupState.TRIGGERED,
          ],
        },
      },
    });

    const latestDaily = await this.prisma.stockDaily.findFirst({
      where: { stockId },
      orderBy: { date: 'desc' },
    });

    const avgVolume =
      bars.length > 0
        ? bars.reduce((sum, b) => sum + b.volume, 0) / bars.length
        : 0;

    return {
      stockId,
      isStage2: latestStage?.stage === 'STAGE_2',
      sma50: latestDaily?.sma50 ? Number(latestDaily.sma50) : undefined,
      sma200: latestDaily?.sma200 ? Number(latestDaily.sma200) : undefined,
      atr14: latestDaily?.atr14 ? Number(latestDaily.atr14) : undefined,
      avgVolume,
      activeBases: activeBases.map((b) => ({
        id: b.id,
        peakPrice: Number(b.peakPrice),
        baseLow: Number(b.baseLow),
        pivotPrice: b.pivotPrice ? Number(b.pivotPrice) : undefined,
        status: b.status,
      })),
      activeSetups: activeSetups.map((s) => ({
        id: s.id,
        type: s.type,
        state: s.state,
        pivotPrice: s.pivotPrice ? Number(s.pivotPrice) : undefined,
      })),
    };
  }

  private async persistSetup(
    stockId: string,
    detected: DetectedSetup,
  ): Promise<void> {
    // Set expiration: 30 trading days (~6 calendar weeks) from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 42);

    await this.prisma.setup.create({
      data: {
        stockId,
        type: detected.type,
        timeframe: detected.timeframe,
        direction: detected.direction,
        state: SetupState.BUILDING,
        pivotPrice: detected.pivotPrice,
        stopPrice: detected.stopPrice,
        targetPrice: detected.targetPrice,
        riskReward: detected.riskReward,
        evidence: detected.evidence ?? [],
        waitingFor: detected.waitingFor,
        metadata: (detected.metadata as any) ?? undefined,
        dailyBaseId: detected.dailyBaseId,
        expiresAt,
      },
    });
  }

  private async updateDailySetupStates(
    stockId: string,
    bars: Bar[],
  ): Promise<void> {
    if (bars.length === 0) return;
    const latestBar = bars[bars.length - 1];
    const abs = averageBarSize(bars);
    const proximityThreshold = 1.5 * abs;

    // Process BUILDING and READY setups
    const pendingSetups = await this.prisma.setup.findMany({
      where: {
        stockId,
        state: { in: [SetupState.BUILDING, SetupState.READY] },
      },
    });

    for (const setup of pendingSetups) {
      let newState: SetupState | null = null;
      let stateReason: string | undefined;

      // BUILDING -> READY: pivot price has been identified
      if (setup.state === SetupState.BUILDING && setup.pivotPrice) {
        newState = SetupState.READY;
        stateReason = 'pivot_identified';
      }

      // READY -> TRIGGERED: price closed above pivot (LONG) or below pivot (SHORT)
      if (setup.state === SetupState.READY && setup.pivotPrice) {
        const pivot = Number(setup.pivotPrice);
        if (setup.direction === 'LONG' && latestBar.close > pivot) {
          newState = SetupState.TRIGGERED;
          stateReason = 'breakout_above_pivot';
        } else if (setup.direction === 'SHORT' && latestBar.close < pivot) {
          newState = SetupState.TRIGGERED;
          stateReason = 'breakdown_below_pivot';
        }
      }

      // VIOLATED: price closed beyond stop price with ABS buffer
      if (setup.stopPrice) {
        const stop = Number(setup.stopPrice);
        if (setup.direction === 'LONG' && latestBar.close < stop - abs) {
          newState = SetupState.VIOLATED;
          stateReason = 'stop_violated';
        } else if (
          setup.direction === 'SHORT' &&
          latestBar.close > stop + abs
        ) {
          newState = SetupState.VIOLATED;
          stateReason = 'stop_violated';
        }
      }

      // EXPIRED: price moved too far from pivot (beyond 1.5 * ABS)
      if (
        !newState &&
        setup.pivotPrice &&
        (setup.state === SetupState.BUILDING ||
          setup.state === SetupState.READY)
      ) {
        const pivot = Number(setup.pivotPrice);
        const distFromPivot = Math.abs(latestBar.close - pivot);
        if (distFromPivot > proximityThreshold) {
          // For LONG setups that dropped far below pivot, expire
          // For SHORT setups that rallied far above pivot, expire
          const priceMovedAway =
            (setup.direction === 'LONG' && latestBar.close < pivot - proximityThreshold) ||
            (setup.direction === 'SHORT' && latestBar.close > pivot + proximityThreshold);
          if (priceMovedAway) {
            newState = SetupState.EXPIRED;
            stateReason = 'expired_distance';
          }
        }
      }

      if (newState) {
        const existingMeta =
          (setup.metadata as Record<string, unknown>) ?? {};
        await this.prisma.setup.update({
          where: { id: setup.id },
          data: {
            state: newState,
            lastStateAt: new Date(),
            metadata: { ...existingMeta, stateReason },
          },
        });
      }
    }

    // Process TRIGGERED setups: check if succeeded or violated
    const triggeredSetups = await this.prisma.setup.findMany({
      where: {
        stockId,
        state: SetupState.TRIGGERED,
      },
    });

    for (const setup of triggeredSetups) {
      let newState: SetupState | null = null;
      let stateReason: string | undefined;

      // Check if stop was hit
      if (setup.stopPrice) {
        const stop = Number(setup.stopPrice);
        if (setup.direction === 'LONG' && latestBar.close < stop) {
          newState = SetupState.VIOLATED;
          stateReason = 'stop_hit_after_trigger';
        } else if (setup.direction === 'SHORT' && latestBar.close > stop) {
          newState = SetupState.VIOLATED;
          stateReason = 'stop_hit_after_trigger';
        }
      }

      // Check if target was reached (mark as expired with succeeded reason)
      if (!newState && setup.targetPrice) {
        const target = Number(setup.targetPrice);
        if (setup.direction === 'LONG' && latestBar.close >= target) {
          newState = SetupState.EXPIRED;
          stateReason = 'target_reached';
        } else if (setup.direction === 'SHORT' && latestBar.close <= target) {
          newState = SetupState.EXPIRED;
          stateReason = 'target_reached';
        }
      }

      // Check if price moved far from entry area (beyond pivot + 3 * ABS)
      if (!newState && setup.pivotPrice) {
        const pivot = Number(setup.pivotPrice);
        const farThreshold = 3 * abs;
        if (setup.direction === 'LONG' && latestBar.close > pivot + farThreshold) {
          newState = SetupState.EXPIRED;
          stateReason = 'left_entry_area';
        } else if (
          setup.direction === 'SHORT' &&
          latestBar.close < pivot - farThreshold
        ) {
          newState = SetupState.EXPIRED;
          stateReason = 'left_entry_area';
        }
      }

      if (newState) {
        const existingMeta =
          (setup.metadata as Record<string, unknown>) ?? {};
        await this.prisma.setup.update({
          where: { id: setup.id },
          data: {
            state: newState,
            lastStateAt: new Date(),
            metadata: { ...existingMeta, stateReason },
          },
        });
      }
    }
  }

  private async expireStaleSetups(stockId: string): Promise<void> {
    await this.prisma.setup.updateMany({
      where: {
        stockId,
        state: { in: [SetupState.BUILDING, SetupState.READY] },
        expiresAt: { lt: new Date() },
      },
      data: { state: SetupState.EXPIRED, lastStateAt: new Date() },
    });
  }

  async getActiveSetups(filters?: {
    type?: SetupType;
    direction?: string;
    timeframe?: Timeframe;
  }) {
    return this.prisma.setup.findMany({
      where: {
        state: {
          in: [
            SetupState.BUILDING,
            SetupState.READY,
            SetupState.TRIGGERED,
          ],
        },
        ...(filters?.type && { type: filters.type }),
        ...(filters?.direction && {
          direction: filters.direction as any,
        }),
        ...(filters?.timeframe && { timeframe: filters.timeframe }),
      },
      include: { stock: true },
      orderBy: { detectedAt: 'desc' },
    });
  }

  async getSetupById(id: string) {
    return this.prisma.setup.findUniqueOrThrow({
      where: { id },
      include: {
        stock: true,
        barEvidence: { orderBy: { barDate: 'desc' } },
      },
    });
  }

  /**
   * Simulate setup detection across full historical data without persisting.
   * Runs the detection engine with a sliding window over all bars.
   * Returns all detected setups with state transitions and trade metrics.
   */
  async simulateDetection(
    ticker: string,
    fromDate?: Date,
  ): Promise<SimulatedSetup[]> {
    const stock = await this.prisma.stock.findUniqueOrThrow({
      where: { ticker: ticker.toUpperCase() },
    });

    const where: any = { stockId: stock.id };
    if (fromDate) {
      where.date = { gte: fromDate };
    }

    const dailyBars = await this.prisma.stockDaily.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    if (dailyBars.length < 50) return [];

    const bars: Bar[] = dailyBars.map((b) => ({
      open: Number(b.open),
      high: Number(b.high),
      low: Number(b.low),
      close: Number(b.close),
      volume: Number(b.volume),
      date: b.date,
    }));

    const results: SimulatedSetup[] = [];
    const windowSize = 252;
    const minBars = 50;
    const activeSimSetups: SimulatedSetup[] = [];

    for (let i = minBars; i <= bars.length; i++) {
      const windowStart = Math.max(0, i - windowSize);
      const windowBars = bars.slice(windowStart, i);
      const latestBar = windowBars[windowBars.length - 1];
      const abs = averageBarSize(windowBars);

      const swingPoints = detectSwingPoints(windowBars);

      // Compute isStage2 from real SMA data
      const sma50 = dailyBars[i - 1]?.sma50
        ? Number(dailyBars[i - 1].sma50)
        : undefined;
      const sma200 = dailyBars[i - 1]?.sma200
        ? Number(dailyBars[i - 1].sma200)
        : undefined;
      const isStage2 =
        sma50 != null &&
        sma200 != null &&
        latestBar.close > sma50 &&
        sma50 > sma200;

      const atr14 = dailyBars[i - 1]?.atr14
        ? Number(dailyBars[i - 1].atr14)
        : undefined;

      const simContext: DailyDetectorContext = {
        stockId: stock.id,
        isStage2,
        sma50,
        sma200,
        atr14,
        avgVolume:
          windowBars.reduce((sum, b) => sum + b.volume, 0) /
          windowBars.length,
        activeBases: [],
        activeSetups: activeSimSetups
          .filter((s) => s.state === 'BUILDING' || s.state === 'READY')
          .map((s) => ({
            id: s.id,
            type: s.type as SetupType,
            state: s.state,
            pivotPrice: s.pivotPrice ?? undefined,
          })),
      };

      // Run detectors
      for (const detector of this.dailyDetectors) {
        const result = detector.detect(windowBars, swingPoints, simContext);
        if (result) {
          const tradeCategory = BREAKOUT_TYPES.includes(result.type)
            ? 'BREAKOUT'
            : REVERSAL_TYPES.includes(result.type)
              ? 'REVERSAL'
              : null;

          const simSetup: SimulatedSetup = {
            id: `sim-${results.length}`,
            type: result.type,
            direction: result.direction,
            state: 'BUILDING',
            detectedAt: latestBar.date?.toISOString() ?? '',
            pivotPrice: result.pivotPrice ?? null,
            stopPrice: result.stopPrice ?? null,
            targetPrice: result.targetPrice ?? null,
            riskReward: result.riskReward ?? null,
            evidence: result.evidence ?? [],
            metadata: result.metadata ?? {},
            stateHistory: [
              {
                state: 'BUILDING',
                date: latestBar.date?.toISOString() ?? '',
              },
            ],
            tradeCategory,
            entryPrice: null,
            entryDate: null,
            exitPrice: null,
            exitDate: null,
            actualStopPrice: null,
            riskAmount: null,
            maxR: null,
            maxPct: null,
            finalR: null,
            finalPct: null,
            holdingDays: null,
          };

          if (simSetup.pivotPrice) {
            simSetup.state = 'READY';
            simSetup.stateHistory.push({
              state: 'READY',
              date: latestBar.date?.toISOString() ?? '',
            });
          }

          results.push(simSetup);
          activeSimSetups.push(simSetup);
        }
      }

      // Update states of active simulated setups
      for (const setup of activeSimSetups) {
        if (setup.state === 'EXPIRED' || setup.state === 'VIOLATED') continue;

        const dateStr = latestBar.date?.toISOString() ?? '';

        // READY -> TRIGGERED with entry/stop calculation
        if (setup.state === 'READY' && setup.pivotPrice) {
          const triggered =
            (setup.direction === 'LONG' &&
              latestBar.close > setup.pivotPrice) ||
            (setup.direction === 'SHORT' &&
              latestBar.close < setup.pivotPrice);

          if (triggered) {
            setup.state = 'TRIGGERED';
            setup.entryPrice = setup.pivotPrice;
            setup.entryDate = dateStr;

            // Determine actualStopPrice based on trade category
            if (setup.tradeCategory === 'BREAKOUT') {
              setup.actualStopPrice = setup.stopPrice;
            } else {
              // Reversal: stop = day low (LONG) or day high (SHORT)
              setup.actualStopPrice =
                setup.direction === 'LONG'
                  ? latestBar.low
                  : latestBar.high;
            }

            setup.riskAmount =
              setup.entryPrice != null && setup.actualStopPrice != null
                ? Math.abs(setup.entryPrice - setup.actualStopPrice)
                : null;

            setup.stateHistory.push({ state: 'TRIGGERED', date: dateStr });
            continue;
          }
        }

        // BUILDING/READY: VIOLATED via stop hit (with ABS buffer)
        if (
          (setup.state === 'BUILDING' || setup.state === 'READY') &&
          setup.stopPrice
        ) {
          const violated =
            (setup.direction === 'LONG' &&
              latestBar.close < setup.stopPrice - abs) ||
            (setup.direction === 'SHORT' &&
              latestBar.close > setup.stopPrice + abs);
          if (violated) {
            setup.state = 'VIOLATED';
            setup.stateHistory.push({ state: 'VIOLATED', date: dateStr });
            continue;
          }
        }

        // BUILDING/READY: EXPIRED via distance from pivot
        if (
          (setup.state === 'BUILDING' || setup.state === 'READY') &&
          setup.pivotPrice
        ) {
          const proximityThreshold = 1.5 * abs;
          const farAway =
            (setup.direction === 'LONG' &&
              latestBar.close < setup.pivotPrice - proximityThreshold) ||
            (setup.direction === 'SHORT' &&
              latestBar.close > setup.pivotPrice + proximityThreshold);
          if (farAway) {
            setup.state = 'EXPIRED';
            setup.stateHistory.push({ state: 'EXPIRED', date: dateStr });
            continue;
          }
        }

        // TRIGGERED: track R-multiple each bar
        if (
          setup.state === 'TRIGGERED' &&
          setup.entryPrice != null &&
          setup.riskAmount != null &&
          setup.riskAmount > 0
        ) {
          if (setup.direction === 'LONG') {
            const barMaxR =
              (latestBar.high - setup.entryPrice) / setup.riskAmount;
            const barMaxPct =
              ((latestBar.high - setup.entryPrice) / setup.entryPrice) * 100;
            setup.maxR = Math.max(setup.maxR ?? 0, barMaxR);
            setup.maxPct = Math.max(setup.maxPct ?? 0, barMaxPct);
          } else {
            const barMaxR =
              (setup.entryPrice - latestBar.low) / setup.riskAmount;
            const barMaxPct =
              ((setup.entryPrice - latestBar.low) / setup.entryPrice) * 100;
            setup.maxR = Math.max(setup.maxR ?? 0, barMaxR);
            setup.maxPct = Math.max(setup.maxPct ?? 0, barMaxPct);
          }

          // Check stop hit using actualStopPrice
          let exited = false;
          if (setup.actualStopPrice != null) {
            const stopHit =
              (setup.direction === 'LONG' &&
                latestBar.close < setup.actualStopPrice) ||
              (setup.direction === 'SHORT' &&
                latestBar.close > setup.actualStopPrice);
            if (stopHit) {
              setup.state = 'VIOLATED';
              exited = true;
            }
          }

          // Check target reached
          if (!exited && setup.targetPrice != null) {
            const targetHit =
              (setup.direction === 'LONG' &&
                latestBar.close >= setup.targetPrice) ||
              (setup.direction === 'SHORT' &&
                latestBar.close <= setup.targetPrice);
            if (targetHit) {
              setup.state = 'EXPIRED';
              exited = true;
            }
          }

          if (exited) {
            setup.exitPrice = latestBar.close;
            setup.exitDate = dateStr;

            if (setup.direction === 'LONG') {
              setup.finalR =
                (latestBar.close - setup.entryPrice) / setup.riskAmount;
              setup.finalPct =
                ((latestBar.close - setup.entryPrice) / setup.entryPrice) *
                100;
            } else {
              setup.finalR =
                (setup.entryPrice - latestBar.close) / setup.riskAmount;
              setup.finalPct =
                ((setup.entryPrice - latestBar.close) / setup.entryPrice) *
                100;
            }

            // Count trading days between entry and exit
            if (setup.entryDate) {
              const entryTime = new Date(setup.entryDate).getTime();
              const exitTime = new Date(dateStr).getTime();
              setup.holdingDays = Math.round(
                (exitTime - entryTime) / (1000 * 60 * 60 * 24),
              );
            }

            setup.stateHistory.push({ state: setup.state, date: dateStr });
            continue;
          }
        }
      }
    }

    return results;
  }
}

const BREAKOUT_TYPES: SetupType[] = [
  'VCP' as SetupType,
  'BREAKOUT_PIVOT' as SetupType,
  'HIGH_TIGHT_FLAG' as SetupType,
  'PULLBACK_BUY' as SetupType,
];
const REVERSAL_TYPES: SetupType[] = [
  'UNDERCUT_RALLY' as SetupType,
  'DOUBLE_TOP' as SetupType,
  'FAIL_BASE' as SetupType,
  'FAIL_BREAKOUT' as SetupType,
];

export interface SimulatedSetup {
  id: string;
  type: SetupType;
  direction: string;
  state: string;
  detectedAt: string;
  pivotPrice: number | null;
  stopPrice: number | null;
  targetPrice: number | null;
  riskReward: number | null;
  evidence: string[];
  metadata: Record<string, unknown>;
  stateHistory: Array<{ state: string; date: string }>;
  tradeCategory: 'BREAKOUT' | 'REVERSAL' | null;
  entryPrice: number | null;
  entryDate: string | null;
  exitPrice: number | null;
  exitDate: string | null;
  actualStopPrice: number | null;
  riskAmount: number | null;
  maxR: number | null;
  maxPct: number | null;
  finalR: number | null;
  finalPct: number | null;
  holdingDays: number | null;
}
