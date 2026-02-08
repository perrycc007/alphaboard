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
import { MomentumContinuationDetector } from './detectors/daily/momentum.detector';
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
    new MomentumContinuationDetector(),
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

    const activeSetups = await this.prisma.setup.findMany({
      where: {
        stockId,
        state: { in: [SetupState.BUILDING, SetupState.READY] },
      },
    });

    for (const setup of activeSetups) {
      let newState: SetupState | null = null;

      if (setup.state === SetupState.BUILDING && setup.pivotPrice) {
        newState = SetupState.READY;
      }

      if (
        setup.state === SetupState.READY &&
        setup.pivotPrice &&
        latestBar.close > Number(setup.pivotPrice)
      ) {
        newState = SetupState.TRIGGERED;
      }

      if (
        setup.stopPrice &&
        latestBar.close < Number(setup.stopPrice) - abs
      ) {
        newState = SetupState.VIOLATED;
      }

      if (newState) {
        await this.prisma.setup.update({
          where: { id: setup.id },
          data: { state: newState, lastStateAt: new Date() },
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
}
