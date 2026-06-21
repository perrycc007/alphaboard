import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SetupState, SetupType, Timeframe } from '@prisma/client';
import { Bar } from '../../common/types';
import {
  detectSignificantSwingPoints,
  averageBarSize,
  detectMarketRegime,
} from './primitives';
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
import { Ema20PullbackDetector } from './detectors/daily/ema20-pullback.detector';
import { MaRallyFailureDetector } from './detectors/daily/ma-rally-failure.detector';
import { Sma200KeyLevelDetector } from './detectors/daily/sma200-key-level.detector';
import { IntradayBaseDetector } from './detectors/intraday/intraday-base.detector';
import { Cross620Detector } from './detectors/intraday/cross620.detector';
import { GapDetector } from './detectors/intraday/gap.detector';
import { TiringDownDetector } from './detectors/intraday/tiring-down.detector';
import { IntradayDoubleTopDetector } from './detectors/intraday/intraday-double-top.detector';
import { IntradayUndercutRallyDetector } from './detectors/intraday/intraday-undercut-rally.detector';
import {
  evaluateBar as evaluateConfirmation,
  BarContext,
} from './confirmation/confirmation-engine';
import { appendJsonLog } from '../../common/utils/file-log.util';
import { TimingSignalService } from './timing-signal.service';
import { PythonSignalDetectorService } from './python-signal-detector.service';
import type {
  SetupAuditDetectedSetup,
  SetupAuditScanResult,
} from './setup-audit.service';

// ---------------------------------------------------------------------------
// Scanner ranking scores
// ---------------------------------------------------------------------------

const TYPE_SCORES: Record<string, number> = {
  EMA200_KEY_LEVEL: 100,
  MA_RALLY_FAILURE: 80,
  DOUBLE_TOP: 75,
  UNDERCUT_RALLY: 75,
  EMA20_PULLBACK: 60,
  VCP: 55,
  BREAKOUT_PIVOT: 50,
  HIGH_TIGHT_FLAG: 50,
  FAIL_BASE: 45,
  FAIL_BREAKOUT: 45,
  PULLBACK_BUY: 40,
  INTRADAY_BASE: 30,
  CROSS_620: 25,
  GAP_UP: 20,
  GAP_DOWN: 20,
  TIRING_DOWN: 15,
};

const SETUP_DEDUP_COOLDOWN_DAYS: Partial<Record<SetupType, number>> = {
  [SetupType.BREAKOUT_PIVOT]: 10,
  [SetupType.FAIL_BASE]: 12,
  [SetupType.FAIL_BREAKOUT]: 12,
  [SetupType.VCP]: 15,
  [SetupType.DOUBLE_TOP]: 15,
  [SetupType.EMA20_PULLBACK]: 10,
  [SetupType.MA_RALLY_FAILURE]: 12,
};

function scoreSetup(setup: { type: string | SetupType }): number {
  return TYPE_SCORES[setup.type] ?? 0;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

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
    new Ema20PullbackDetector(),
    new MaRallyFailureDetector(),
    new Sma200KeyLevelDetector(),
  ];

  private readonly intradayDetectors = [
    new IntradayBaseDetector(),
    new Cross620Detector(),
    new GapDetector(),
    new TiringDownDetector(),
    new IntradayDoubleTopDetector(),
    new IntradayUndercutRallyDetector(),
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly timingSignalService: TimingSignalService,
    private readonly pythonSignalDetector: PythonSignalDetectorService,
  ) {}

  async runDailyDetection(
    stockId: string,
    bars: Bar[],
  ): Promise<SetupAuditScanResult> {
    const swingPoints = detectSignificantSwingPoints(bars);
    const context = await this.buildDailyContext(stockId, bars);
    const detectedAt = bars[bars.length - 1]?.date ?? new Date();
    const auditResult: SetupAuditScanResult = {
      detectorSource: 'typescript',
      created: [],
      deduped: [],
      suppressed: [],
    };

    let pythonResults: DetectedSetup[] | null = null;
    try {
      pythonResults = await this.pythonSignalDetector.detectDailySignals(bars);
      if (pythonResults) auditResult.detectorSource = 'python';
    } catch (error) {
      this.logger.warn(
        `Python signal detector failed for stock ${stockId}; falling back to TypeScript detectors: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (pythonResults) {
      for (const result of pythonResults) {
        if (result.direction === 'SHORT' && !context.canShortLeader) {
          auditResult.suppressed.push(
            this.toAuditDetectedSetup(result, detectedAt, {
              detectorSource: auditResult.detectorSource,
              outcome: 'suppressed',
              reason: 'SHORT_NOT_ALLOWED',
            }),
          );
          continue;
        }
        const persisted = await this.persistSetup(stockId, result, detectedAt);
        auditResult[persisted.outcome === 'created' ? 'created' : 'deduped'].push(
          {
            ...persisted.setup,
            detectorSource: auditResult.detectorSource,
          },
        );
        this.logger.log(
          `Detected ${result.type} via Python signal logic for stock ${stockId}`,
        );
      }
    } else {
      for (const detector of this.dailyDetectors) {
        const result = detector.detect(bars, swingPoints, context);
        if (result) {
          if (result.direction === 'SHORT' && !context.canShortLeader) {
            auditResult.suppressed.push(
              this.toAuditDetectedSetup(result, detectedAt, {
                detectorSource: auditResult.detectorSource,
                outcome: 'suppressed',
                reason: 'SHORT_NOT_ALLOWED',
              }),
            );
            continue;
          }
          const persisted = await this.persistSetup(stockId, result, detectedAt);
          auditResult[
            persisted.outcome === 'created' ? 'created' : 'deduped'
          ].push({
            ...persisted.setup,
            detectorSource: auditResult.detectorSource,
          });
          this.logger.log(`Detected ${result.type} for stock ${stockId}`);
        }
      }
    }

    await this.updateDailySetupStates(stockId, bars);
    await this.expireStaleSetups(stockId, detectedAt);
    return auditResult;
  }

  async processIntradayBar(
    stockId: string,
    bars: Bar[],
    confirmContext: BarContext,
  ): Promise<void> {
    const context = await this.buildDailyContext(stockId, bars);

    if (context.activeSetups?.some((setup) => setup.timeframe === 'DAILY')) {
      await this.timingSignalService.evaluateAndPersist(stockId, bars, context);
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
    const [latestStage, activeBases, activeSetups, latestDaily, qualifiedLeaderRun] =
      await Promise.all([
        this.prisma.stockStage.findFirst({
          where: { stockId },
          orderBy: { date: 'desc' },
        }),
        this.prisma.dailyBase.findMany({
          where: { stockId, status: { in: ['FORMING', 'COMPLETE'] } },
        }),
        this.prisma.setup.findMany({
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
        }),
        this.prisma.stockDaily.findFirst({
          where: { stockId },
          orderBy: { date: 'desc' },
        }),
        this.prisma.leaderRun.findFirst({
          where: { stockId, isQualified: true },
          orderBy: { stage2EndDate: 'desc' },
        }),
      ]);

    const avgVolume =
      bars.length > 0
        ? bars.reduce((sum, b) => sum + b.volume, 0) / bars.length
        : 0;

    const sma50 = latestDaily?.sma50 ? Number(latestDaily.sma50) : undefined;
    const sma200 = latestDaily?.sma200 ? Number(latestDaily.sma200) : undefined;
    const ema20 = latestDaily?.ema20 ? Number(latestDaily.ema20) : undefined;
    const atr14 = latestDaily?.atr14 ? Number(latestDaily.atr14) : undefined;
    const canShortLeader =
      !!qualifiedLeaderRun &&
      (latestStage?.stage === 'STAGE_3' || latestStage?.stage === 'STAGE_4');

    const activeSetupsMapped = activeSetups.map((s) => ({
      id: s.id,
      type: s.type,
      state: s.state,
      direction: s.direction,
      timeframe: s.timeframe,
      detectedAt: s.detectedAt,
      lastStateAt: s.lastStateAt,
      pivotPrice: s.pivotPrice ? Number(s.pivotPrice) : undefined,
      stopPrice: s.stopPrice ? Number(s.stopPrice) : undefined,
      targetPrice: s.targetPrice ? Number(s.targetPrice) : undefined,
      metadata:
        s.metadata && typeof s.metadata === 'object'
          ? (s.metadata as Record<string, unknown>)
          : undefined,
    }));

    // Compute market regime
    const regime = detectMarketRegime({
      bars,
      ema20,
      sma50,
      sma200,
      atr14,
      activeSetups: activeSetupsMapped.map((s) => ({
        type: s.type,
        state: s.state,
      })),
    });

    return {
      stockId,
      isStage2: latestStage?.stage === 'STAGE_2',
      sma50,
      sma200,
      ema20,
      atr14,
      avgVolume,
      activeBases: activeBases.map((b) => ({
        id: b.id,
        peakPrice: Number(b.peakPrice),
        baseLow: Number(b.baseLow),
        pivotPrice: b.pivotPrice ? Number(b.pivotPrice) : undefined,
        status: b.status,
      })),
      activeSetups: activeSetupsMapped,
      latestStage: latestStage?.stage,
      hasQualifiedLeaderRun: !!qualifiedLeaderRun,
      canShortLeader,
      keyLevels: [
        ...(activeSetupsMapped.flatMap((setup) => {
          const levels: Array<{
            type: any;
            price: number;
            bias: 'LONG' | 'SHORT' | 'BOTH';
          }> = [];
          if (setup.pivotPrice != null) {
            levels.push({
              type: 'VCP_PIVOT',
              price: setup.pivotPrice,
              bias: setup.direction,
            });
          }
          if (setup.stopPrice != null) {
            levels.push({
              type: setup.direction === 'LONG' ? 'BASE_LOW' : 'BASE_HIGH',
              price: setup.stopPrice,
              bias: setup.direction,
            });
          }
          if (setup.targetPrice != null) {
            levels.push({
              type: setup.direction === 'LONG' ? 'SWING_HIGH' : 'SWING_LOW',
              price: setup.targetPrice,
              bias: setup.direction,
            });
          }
          return levels;
        })),
        ...(sma50 != null
          ? [{ type: 'MA_50', price: sma50, bias: 'BOTH' as const }]
          : []),
        ...(sma200 != null
          ? [{ type: 'MA_200', price: sma200, bias: 'BOTH' as const }]
          : []),
      ],
      regime,
    };
  }

  private async persistSetup(
    stockId: string,
    detected: DetectedSetup,
    detectedAt: Date,
  ): Promise<{ outcome: 'created' | 'deduped'; setup: SetupAuditDetectedSetup }> {
    const expiresAt = new Date(detectedAt);
    expiresAt.setDate(expiresAt.getDate() + 42);

    const stock = await this.prisma.stock.findUnique({
      where: { id: stockId },
      select: { ticker: true },
    });

    const recentDuplicate = await this.findRecentDuplicateSetup(
      stockId,
      detected,
      detectedAt,
    );
    if (recentDuplicate) {
      await this.logEvent(
        'setup_orchestrator',
        'setup_deduped',
        stock?.ticker,
        detected.type,
        {
          duplicateOfSetupId: recentDuplicate.id,
          detectedAt: detectedAt.toISOString(),
          pivotPrice: detected.pivotPrice,
          direction: detected.direction,
        },
      );
      return {
        outcome: 'deduped',
        setup: this.toAuditDetectedSetup(detected, detectedAt, {
          setupId: recentDuplicate.id,
          outcome: 'deduped',
          reason: 'RECENT_DUPLICATE',
        }),
      };
    }

    const setup = await this.prisma.setup.create({
      data: {
        stockId,
        type: detected.type,
        timeframe: detected.timeframe,
        direction: detected.direction,
        state: SetupState.BUILDING,
        detectedAt,
        lastStateAt: detectedAt,
        pivotPrice: detected.pivotPrice,
        stopPrice: detected.stopPrice,
        targetPrice: detected.targetPrice,
        riskReward: detected.riskReward,
        evidence: detected.evidence ?? [],
        waitingFor: detected.waitingFor,
        metadata: ({
          ...(detected.metadata ?? {}),
          audit: {
            dedupeWindowDays: this.getDetectionCooldownDays(detected.type),
          },
        } as any),
        dailyBaseId: detected.dailyBaseId,
        expiresAt,
      },
    });

    await this.logEvent('setup_orchestrator', 'setup_detected', stock?.ticker, detected.type, {
      setupId: setup.id,
      direction: detected.direction,
      timeframe: detected.timeframe,
      pivotPrice: detected.pivotPrice,
      stopPrice: detected.stopPrice,
      targetPrice: detected.targetPrice,
      riskReward: detected.riskReward,
      evidence: detected.evidence,
    });

    return {
      outcome: 'created',
      setup: this.toAuditDetectedSetup(detected, detectedAt, {
        setupId: setup.id,
        state: setup.state,
        outcome: 'created',
      }),
    };
  }

  private toAuditDetectedSetup(
    detected: DetectedSetup,
    detectedAt: Date,
    extra: Partial<SetupAuditDetectedSetup> = {},
  ): SetupAuditDetectedSetup {
    return {
      setupId: extra.setupId,
      type: detected.type,
      direction: detected.direction,
      timeframe: detected.timeframe,
      state: extra.state,
      pivotPrice: detected.pivotPrice ?? null,
      stopPrice: detected.stopPrice ?? null,
      targetPrice: detected.targetPrice ?? null,
      riskReward: detected.riskReward ?? null,
      evidence: detected.evidence ?? [],
      waitingFor: detected.waitingFor ?? null,
      detectedAt: detectedAt.toISOString(),
      detectorSource: extra.detectorSource,
      outcome: extra.outcome,
      reason: extra.reason,
    };
  }

  private getDetectionCooldownDays(type: SetupType): number {
    return SETUP_DEDUP_COOLDOWN_DAYS[type] ?? 7;
  }

  private getPivotTolerance(price: number): number {
    return Math.max(0.5, Math.abs(price) * 0.01);
  }

  private isStructurallySimilarSetup(
    candidate: {
      pivotPrice: unknown;
      metadata: unknown;
    },
    detected: DetectedSetup,
  ): boolean {
    if (candidate.pivotPrice != null && detected.pivotPrice != null) {
      const candidatePivot = Number(candidate.pivotPrice);
      const tolerance = this.getPivotTolerance(candidatePivot);
      if (Math.abs(candidatePivot - detected.pivotPrice) > tolerance) {
        return false;
      }
    }

    const candidateMeta =
      candidate.metadata && typeof candidate.metadata === 'object'
        ? (candidate.metadata as Record<string, unknown>)
        : null;
    const detectedMeta = detected.metadata ?? null;

    const candidateContext =
      candidateMeta && typeof candidateMeta.context === 'string'
        ? candidateMeta.context
        : null;
    const detectedContext =
      detectedMeta && typeof detectedMeta.context === 'string'
        ? detectedMeta.context
        : null;
    if (candidateContext && detectedContext && candidateContext !== detectedContext) {
      return false;
    }

    const candidateClass =
      candidateMeta && typeof candidateMeta.setupClass === 'string'
        ? candidateMeta.setupClass
        : null;
    const detectedClass =
      detectedMeta && typeof detectedMeta.setupClass === 'string'
        ? detectedMeta.setupClass
        : null;
    if (candidateClass && detectedClass && candidateClass !== detectedClass) {
      return false;
    }

    return true;
  }

  private async findRecentDuplicateSetup(
    stockId: string,
    detected: DetectedSetup,
    detectedAt: Date,
  ): Promise<{ id: string } | null> {
    const cutoff = new Date(detectedAt);
    cutoff.setDate(cutoff.getDate() - this.getDetectionCooldownDays(detected.type));

    const recentSetups = await this.prisma.setup.findMany({
      where: {
        stockId,
        type: detected.type,
        direction: detected.direction,
        timeframe: detected.timeframe,
        detectedAt: { gte: cutoff },
      },
      orderBy: { detectedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        pivotPrice: true,
        metadata: true,
      },
    });

    return (
      recentSetups.find((candidate) =>
        this.isStructurallySimilarSetup(candidate, detected),
      ) ?? null
    );
  }

  private hasRecentSimulationDuplicate(
    existing: SimulatedSetup[],
    detected: DetectedSetup,
    detectedAt: Date,
  ): boolean {
    const cooldownMs =
      this.getDetectionCooldownDays(detected.type) * 24 * 60 * 60 * 1000;
    return existing.some((candidate) => {
      if (candidate.state === SIM_INVALID_RISK_STATE) {
        return false;
      }
      if (
        candidate.type !== detected.type ||
        candidate.direction !== detected.direction ||
        !candidate.detectedAt
      ) {
        return false;
      }

      const candidateDetectedAt = new Date(candidate.detectedAt);
      if (Math.abs(detectedAt.getTime() - candidateDetectedAt.getTime()) > cooldownMs) {
        return false;
      }

      return this.isStructurallySimilarSetup(
        {
          pivotPrice: candidate.pivotPrice,
          metadata: candidate.metadata,
        },
        detected,
      );
    });
  }

  private async updateDailySetupStates(
    stockId: string,
    bars: Bar[],
  ): Promise<void> {
    if (bars.length === 0) return;
    const latestBar = bars[bars.length - 1];
    const abs = averageBarSize(bars);
    const atr14 = bars.length > 0 ? (bars[bars.length - 1] as any).atr14 : undefined;
    const atr = atr14 ?? abs;
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
      const sameDetectionBar =
        !!latestBar.date &&
        setup.detectedAt.toISOString().slice(0, 10) ===
          latestBar.date.toISOString().slice(0, 10);

      // --- Per-type state transitions for DOUBLE_TOP ---
      if (
        setup.type === SetupType.DOUBLE_TOP &&
        setup.state === SetupState.BUILDING &&
        setup.pivotPrice
      ) {
        const pivot = Number(setup.pivotPrice);
        const breakTol = 0.1 * atr;
        // BUILDING -> READY: High exceeds Top1 + breakTol
        if (latestBar.high > pivot + breakTol) {
          newState = SetupState.READY;
          stateReason = 'top2_exceeded_top1';
        }
      }

      if (
        setup.type === SetupType.DOUBLE_TOP &&
        setup.state === SetupState.READY &&
        setup.pivotPrice
      ) {
        const pivot = Number(setup.pivotPrice);
        // READY -> TRIGGERED: Low < Top1 (intrabar failure)
        if (latestBar.low < pivot) {
          newState = SetupState.TRIGGERED;
          stateReason = 'intrabar_failure_below_top1';
        }
      }

      // --- Per-type state transitions for UNDERCUT_RALLY ---
      if (
        setup.type === SetupType.UNDERCUT_RALLY &&
        setup.state === SetupState.BUILDING &&
        setup.pivotPrice
      ) {
        const pivot = Number(setup.pivotPrice);
        const undercutTol = 0.2 * atr;
        // BUILDING -> READY: Low undercuts PriorLow
        if (latestBar.low < pivot - undercutTol) {
          newState = SetupState.READY;
          stateReason = 'undercut_below_prior_low';
        }
      }

      if (
        setup.type === SetupType.UNDERCUT_RALLY &&
        setup.state === SetupState.READY &&
        setup.pivotPrice
      ) {
        const pivot = Number(setup.pivotPrice);
        // READY -> TRIGGERED: High > PriorLow (intrabar reclaim)
        if (latestBar.high > pivot) {
          newState = SetupState.TRIGGERED;
          stateReason = 'intrabar_reclaim_above_prior_low';
        }
      }

      // --- Generic transitions (non-DT/U&R types) ---
      if (
        !newState &&
        setup.type !== SetupType.DOUBLE_TOP &&
        setup.type !== SetupType.UNDERCUT_RALLY
      ) {
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
      }

      // VIOLATED: price closed beyond stop price with ABS buffer
      if (!newState && !sameDetectionBar && setup.stopPrice) {
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
        !sameDetectionBar &&
        setup.pivotPrice &&
        (setup.state === SetupState.BUILDING ||
          setup.state === SetupState.READY)
      ) {
        const pivot = Number(setup.pivotPrice);
        const priceMovedAway =
          (setup.direction === 'LONG' && latestBar.close < pivot - proximityThreshold) ||
          (setup.direction === 'SHORT' && latestBar.close > pivot + proximityThreshold);
        if (priceMovedAway) {
          newState = SetupState.EXPIRED;
          stateReason = 'expired_distance';
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

        const stock = await this.prisma.stock.findUnique({
          where: { id: stockId },
          select: { ticker: true },
        });
        await this.logEvent('setup_orchestrator', 'state_transition', stock?.ticker, setup.type, {
          setupId: setup.id,
          from: setup.state,
          to: newState,
          reason: stateReason,
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

        const stock = await this.prisma.stock.findUnique({
          where: { id: stockId },
          select: { ticker: true },
        });
        await this.logEvent('setup_orchestrator', 'triggered_outcome', stock?.ticker, setup.type, {
          setupId: setup.id,
          from: 'TRIGGERED',
          to: newState,
          reason: stateReason,
        });
      }
    }
  }

  private async expireStaleSetups(
    stockId: string,
    asOfDate = new Date(),
  ): Promise<void> {
    await this.prisma.setup.updateMany({
      where: {
        stockId,
        state: { in: [SetupState.BUILDING, SetupState.READY] },
        expiresAt: { lt: asOfDate },
      },
      data: { state: SetupState.EXPIRED, lastStateAt: new Date() },
    });
  }

  async getActiveSetups(filters?: {
    type?: SetupType;
    direction?: string;
    timeframe?: Timeframe;
  }) {
    const setups = await this.prisma.setup.findMany({
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

    // Sort by scanner ranking score (descending), then by detectedAt (descending)
    return setups.sort((a, b) => {
      const scoreDiff = scoreSetup(b) - scoreSetup(a);
      if (scoreDiff !== 0) return scoreDiff;
      return b.detectedAt.getTime() - a.detectedAt.getTime();
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

  private async logEvent(
    source: string,
    event: string,
    ticker: string | undefined | null,
    setupType: string | undefined | null,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      await appendJsonLog('detector-events.json', {
        source,
        event,
        ticker: ticker ?? null,
        setupType: setupType ?? null,
        payload,
      });
    } catch (err) {
      this.logger.warn(`Failed to write event log: ${err}`);
    }
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

    const [dailyBars, stageHistory, leaderRuns] = await Promise.all([
      this.prisma.stockDaily.findMany({
        where,
        orderBy: { date: 'asc' },
      }),
      this.prisma.stockStage.findMany({
        where: { stockId: stock.id },
        orderBy: { date: 'asc' },
      }),
      this.prisma.leaderRun.findMany({
        where: { stockId: stock.id, isQualified: true },
        orderBy: { stage2EndDate: 'asc' },
      }),
    ]);

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

      const swingPoints = detectSignificantSwingPoints(windowBars);

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

      const ema20 = dailyBars[i - 1]?.ema20
        ? Number(dailyBars[i - 1].ema20)
        : undefined;

      const activeSetupsMapped = activeSimSetups
        .filter((s) => s.state === 'BUILDING' || s.state === 'READY' || s.state === 'TRIGGERED')
        .map((s) => ({
          id: s.id,
          type: s.type as SetupType,
          state: s.state,
          direction: s.direction as any,
          timeframe: Timeframe.DAILY,
          detectedAt: s.detectedAt ? new Date(s.detectedAt) : undefined,
          lastStateAt:
            s.stateHistory.length > 0
              ? new Date(s.stateHistory[s.stateHistory.length - 1].date)
              : undefined,
          pivotPrice: s.pivotPrice ?? undefined,
          stopPrice: s.stopPrice ?? undefined,
          targetPrice: s.targetPrice ?? undefined,
          metadata: s.metadata,
        }));

      const activeStage =
        [...stageHistory]
          .reverse()
          .find((stage) => stage.date.getTime() <= (latestBar.date?.getTime() ?? 0)) ?? null;
      const hasQualifiedLeaderRun = leaderRuns.some(
        (run) => run.stage2EndDate.getTime() < (latestBar.date?.getTime() ?? 0),
      );
      const canShortLeader =
        hasQualifiedLeaderRun &&
        (activeStage?.stage === 'STAGE_3' || activeStage?.stage === 'STAGE_4');

      // Compute regime for simulation
      const regime = detectMarketRegime({
        bars: windowBars,
        ema20,
        sma50,
        sma200,
        atr14,
        activeSetups: activeSetupsMapped.map((s) => ({
          type: s.type,
          state: s.state,
        })),
      });

      const simContext: DailyDetectorContext = {
        stockId: stock.id,
        isStage2,
        latestStage: activeStage?.stage,
        hasQualifiedLeaderRun,
        canShortLeader,
        sma50,
        sma200,
        ema20,
        atr14,
        avgVolume:
          windowBars.reduce((sum, b) => sum + b.volume, 0) /
          windowBars.length,
        activeBases: [],
        activeSetups: activeSetupsMapped,
        keyLevels: [],
        regime,
      };

      // Run detectors
      for (const detector of this.dailyDetectors) {
        const result = detector.detect(windowBars, swingPoints, simContext);
        if (result && !(result.direction === 'SHORT' && !simContext.canShortLeader)) {
          if (
            latestBar.date &&
            this.hasRecentSimulationDuplicate(activeSimSetups, result, latestBar.date)
          ) {
            continue;
          }

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
            rTargets: initializeRTargets(),
            stopHit: {
              hit: false,
              hitDate: null,
              daysToHit: null,
            },
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
      const atrSim = atr14 ?? abs;
      for (const setup of activeSimSetups) {
        if (setup.state === 'EXPIRED' || setup.state === 'VIOLATED') continue;

        const dateStr = latestBar.date?.toISOString() ?? '';

        // --- Per-type transitions for DOUBLE_TOP in simulation ---
        if (setup.type === ('DOUBLE_TOP' as SetupType) && setup.state === 'BUILDING' && setup.pivotPrice) {
          const breakTol = 0.1 * atrSim;
          if (latestBar.high > setup.pivotPrice + breakTol) {
            setup.state = 'READY';
            setup.stateHistory.push({ state: 'READY', date: dateStr });
            continue;
          }
        }

        if (setup.type === ('DOUBLE_TOP' as SetupType) && setup.state === 'READY' && setup.pivotPrice) {
          if (latestBar.low < setup.pivotPrice) {
            triggerSimulatedSetup(setup, latestBar, dateStr, abs);
            continue;
          }
        }

        // --- Per-type transitions for UNDERCUT_RALLY in simulation ---
        if (setup.type === ('UNDERCUT_RALLY' as SetupType) && setup.state === 'BUILDING' && setup.pivotPrice) {
          const undercutTol = 0.2 * atrSim;
          if (latestBar.low < setup.pivotPrice - undercutTol) {
            setup.state = 'READY';
            setup.stateHistory.push({ state: 'READY', date: dateStr });
            continue;
          }
        }

        if (setup.type === ('UNDERCUT_RALLY' as SetupType) && setup.state === 'READY' && setup.pivotPrice) {
          if (latestBar.high > setup.pivotPrice) {
            triggerSimulatedSetup(setup, latestBar, dateStr, abs);
            continue;
          }
        }

        // --- Generic READY -> TRIGGERED ---
        if (
          setup.state === 'READY' &&
          setup.pivotPrice &&
          setup.type !== ('DOUBLE_TOP' as SetupType) &&
          setup.type !== ('UNDERCUT_RALLY' as SetupType)
        ) {
          const triggered =
            (setup.direction === 'LONG' &&
              latestBar.close > setup.pivotPrice) ||
            (setup.direction === 'SHORT' &&
              latestBar.close < setup.pivotPrice);

          if (triggered) {
            triggerSimulatedSetup(setup, latestBar, dateStr, abs);
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
          let exited = false;
          if (setup.actualStopPrice != null) {
            const stopHit =
              (setup.direction === 'LONG' &&
                latestBar.low <= setup.actualStopPrice) ||
              (setup.direction === 'SHORT' &&
                latestBar.high >= setup.actualStopPrice);
            if (stopHit) {
              setup.state = 'VIOLATED';
              setup.stopHit = {
                hit: true,
                hitDate: dateStr,
                daysToHit: setup.entryDate
                  ? daysBetween(setup.entryDate, dateStr)
                  : null,
              };
              exited = true;
            }
          }

          if (exited) {
            setup.exitPrice = setup.actualStopPrice;
            setup.exitDate = dateStr;
            setup.finalR = -1;
            if (setup.entryPrice !== 0 && setup.actualStopPrice != null) {
              setup.finalPct =
                setup.direction === 'LONG'
                  ? ((setup.actualStopPrice - setup.entryPrice) /
                      setup.entryPrice) *
                    100
                  : ((setup.entryPrice - setup.actualStopPrice) /
                      setup.entryPrice) *
                    100;
            }
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

          let barMaxR: number;
          if (setup.direction === 'LONG') {
            barMaxR = (latestBar.high - setup.entryPrice) / setup.riskAmount;
            const barMaxPct =
              ((latestBar.high - setup.entryPrice) / setup.entryPrice) * 100;
            setup.maxR = Math.max(setup.maxR ?? 0, barMaxR);
            setup.maxPct = Math.max(setup.maxPct ?? 0, barMaxPct);
          } else {
            barMaxR = (setup.entryPrice - latestBar.low) / setup.riskAmount;
            const barMaxPct =
              ((setup.entryPrice - latestBar.low) / setup.entryPrice) * 100;
            setup.maxR = Math.max(setup.maxR ?? 0, barMaxR);
            setup.maxPct = Math.max(setup.maxPct ?? 0, barMaxPct);
          }
          recordFixedRTargets(setup, barMaxR, dateStr);

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

    return results.filter((setup) => setup.state !== SIM_INVALID_RISK_STATE);
  }
}

const BREAKOUT_TYPES: SetupType[] = [
  'VCP' as SetupType,
  'BREAKOUT_PIVOT' as SetupType,
  'HIGH_TIGHT_FLAG' as SetupType,
  'PULLBACK_BUY' as SetupType,
  'EMA20_PULLBACK' as SetupType,
];
const REVERSAL_TYPES: SetupType[] = [
  'UNDERCUT_RALLY' as SetupType,
  'DOUBLE_TOP' as SetupType,
  'FAIL_BASE' as SetupType,
  'FAIL_BREAKOUT' as SetupType,
  'MA_RALLY_FAILURE' as SetupType,
  'EMA200_KEY_LEVEL' as SetupType,
];
const SIM_INVALID_RISK_STATE = 'INVALID_RISK';

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
  rTargets: Record<string, FixedRTargetResult>;
  stopHit: {
    hit: boolean;
    hitDate: string | null;
    daysToHit: number | null;
  };
}

interface FixedRTargetResult {
  hit: boolean;
  hitDate: string | null;
  daysToHit: number | null;
  pctMove: number | null;
}

function initializeRTargets(): Record<string, FixedRTargetResult> {
  return {
    '2': { hit: false, hitDate: null, daysToHit: null, pctMove: null },
    '3': { hit: false, hitDate: null, daysToHit: null, pctMove: null },
    '4': { hit: false, hitDate: null, daysToHit: null, pctMove: null },
  };
}

function triggerSimulatedSetup(
  setup: SimulatedSetup,
  triggerBar: Bar,
  dateStr: string,
  averageRange: number,
): void {
  setup.entryPrice = setup.pivotPrice;
  setup.entryDate = dateStr;
  setup.actualStopPrice = getSimulatedStopPrice(setup, triggerBar);
  setup.riskAmount =
    setup.entryPrice != null && setup.actualStopPrice != null
      ? Math.abs(setup.entryPrice - setup.actualStopPrice)
      : null;

  if (
    setup.tradeCategory === 'REVERSAL' &&
    (setup.riskAmount == null || setup.riskAmount <= averageRange)
  ) {
    setup.state = SIM_INVALID_RISK_STATE;
    setup.metadata = {
      ...setup.metadata,
      invalidReason: 'RISK_NOT_GREATER_THAN_AVERAGE_BAR_RANGE',
      averageRange,
      riskAmount: setup.riskAmount,
    };
    setup.stateHistory.push({ state: SIM_INVALID_RISK_STATE, date: dateStr });
    return;
  }

  setup.state = 'TRIGGERED';
  setup.stateHistory.push({ state: 'TRIGGERED', date: dateStr });
}

function getSimulatedStopPrice(
  setup: SimulatedSetup,
  triggerBar: Bar,
): number | null {
  if (setup.tradeCategory === 'BREAKOUT') {
    return setup.stopPrice;
  }
  return setup.direction === 'LONG' ? triggerBar.low : triggerBar.high;
}

function recordFixedRTargets(
  setup: SimulatedSetup,
  barMaxR: number,
  dateStr: string,
): void {
  if (
    setup.entryPrice == null ||
    setup.riskAmount == null ||
    setup.riskAmount <= 0
  ) {
    return;
  }

  for (const target of [2, 3, 4]) {
    const existing = setup.rTargets[String(target)];
    if (existing.hit || barMaxR < target) continue;
    existing.hit = true;
    existing.hitDate = dateStr;
    existing.daysToHit = setup.entryDate ? daysBetween(setup.entryDate, dateStr) : null;
    existing.pctMove = Number(
      (((setup.riskAmount * target) / setup.entryPrice) * 100).toFixed(2),
    );
  }
}

function daysBetween(start: string, end: string): number {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) /
      (1000 * 60 * 60 * 24),
  );
}
