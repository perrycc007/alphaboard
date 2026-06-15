import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Direction, Prisma, SetupType, StageEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ModelReviewService } from './model/model-review.service';

export type TechnicalDirection = Direction | 'WATCH';
export type TechnicalReviewStatus =
  | 'REJECT'
  | 'WATCH'
  | 'FOCUS'
  | 'NEEDS_VISUAL_REVIEW';

export interface DataframeReviewPacket {
  ticker?: string;
  stage?: string;
  setupLabels?: string[];
  latestPrice?: number;
  movingAverages?: Record<string, number>;
  atr?: number;
  volumeRatio?: number;
  nearbyKeyLevels?: Record<string, number>;
  groupConfirmation?: string;
  programEvidence?: string[];
  possibleViolations?: string[];
}

export interface TechnicalReviewInput {
  stockId?: string;
  ticker?: string;
  hypothesisTitle?: string;
  dataframePacket?: DataframeReviewPacket;
  chartImages?: string[];
}

export interface TechnicalReview {
  ticker: string;
  direction: TechnicalDirection;
  setupType: string;
  stage: string;
  keyLevels: Record<string, number | null>;
  entryArea: { low: number | null; high: number | null };
  invalidationLevel: number | null;
  targetArea: { low: number | null; high: number | null };
  riskReward: number;
  groupConfirmation: string;
  visualQualityScore?: number;
  dataframeQualityScore: number;
  reviewStatus: TechnicalReviewStatus;
  reasons: string[];
}

interface TechnicalFacts {
  hasImages: boolean;
  setupType: string;
  stage: string;
  riskReward: number;
  dataframeQualityScore: number;
  visualQualityScore?: number;
  groupConfirmation: string;
}

const BEARISH_SETUPS = new Set<string>([
  SetupType.DOUBLE_TOP,
  SetupType.FAIL_BASE,
  SetupType.FAIL_BREAKOUT,
  SetupType.MA_RALLY_FAILURE,
]);

export function deriveTechnicalReviewStatus(
  facts: TechnicalFacts,
): TechnicalReviewStatus {
  if (facts.riskReward > 0 && facts.riskReward < 2) return 'REJECT';
  if (facts.hasImages && facts.visualQualityScore == null) {
    return 'NEEDS_VISUAL_REVIEW';
  }
  if (
    facts.dataframeQualityScore >= 70 &&
    facts.riskReward >= 3 &&
    !facts.groupConfirmation.toLowerCase().includes('weak')
  ) {
    return 'FOCUS';
  }
  if (facts.setupType === 'NONE' || facts.stage === 'UNKNOWN') return 'WATCH';
  return 'WATCH';
}

@Injectable()
export class TechnicalReviewService {
  private readonly logger = new Logger(TechnicalReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly modelReview: ModelReviewService,
  ) {}

  async review(input: TechnicalReviewInput): Promise<TechnicalReview> {
    if (!input.stockId && !input.ticker && !input.dataframePacket?.ticker) {
      throw new BadRequestException('stockId, ticker, or dataframePacket.ticker is required');
    }

    const ticker = input.ticker ?? input.dataframePacket?.ticker;
    const stock = await this.resolveStock(input.stockId, ticker);
    const [setups, latestStage, bars, modelResult] = await Promise.all([
      stock ? this.loadActiveSetups(stock.id) : Promise.resolve([]),
      stock ? this.loadLatestStage(stock.id) : Promise.resolve(null),
      stock ? this.loadRecentBars(stock.id) : Promise.resolve([]),
      this.runModelReview(input, ticker ?? stock?.ticker ?? 'UNKNOWN'),
    ]);

    const primarySetup = setups[0];
    const latestBar = bars[0];
    const setupType = this.deriveSetupType(input, primarySetup, modelResult);
    const stage = this.deriveStage(input, latestStage?.stage, bars, modelResult);
    const latestPrice =
      input.dataframePacket?.latestPrice ??
      (latestBar ? Number(latestBar.close) : null);
    const keyLevels = this.buildKeyLevels(input, primarySetup, latestBar);
    const entryArea = this.deriveEntryArea(primarySetup, latestPrice, keyLevels);
    const invalidationLevel =
      this.numberOrNull(modelResult.invalidationLevel) ??
      (primarySetup?.stopPrice != null ? Number(primarySetup.stopPrice) : null);
    const target = this.deriveTargetArea(primarySetup, modelResult);
    const riskReward =
      this.numberOrNull(modelResult.riskReward) ??
      this.calculateRiskReward(entryArea, invalidationLevel, target);
    const groupConfirmation =
      input.dataframePacket?.groupConfirmation ??
      this.stringOrUndefined(modelResult.groupConfirmation) ??
      'Unknown; require group/ETF confirmation before focus ranking.';
    const dataframeQualityScore = this.clampScore(
      this.numberOrNull(modelResult.dataframeQualityScore) ??
        this.scoreDataframe(input, setupType, stage, riskReward),
    );
    const visualQualityScore = this.optionalScore(modelResult.visualQualityScore);
    const direction = this.deriveDirection(primarySetup?.direction, setupType);
    const reviewStatus = deriveTechnicalReviewStatus({
      hasImages: (input.chartImages?.length ?? 0) > 0,
      setupType,
      stage,
      riskReward,
      dataframeQualityScore,
      visualQualityScore,
      groupConfirmation,
    });

    return {
      ticker: stock?.ticker ?? ticker ?? 'UNKNOWN',
      direction,
      setupType,
      stage,
      keyLevels,
      entryArea,
      invalidationLevel,
      targetArea: target,
      riskReward,
      groupConfirmation,
      ...(visualQualityScore != null ? { visualQualityScore } : {}),
      dataframeQualityScore,
      reviewStatus,
      reasons: this.buildReasons(input, setupType, stage, riskReward, modelResult),
    };
  }

  private async runModelReview(
    input: TechnicalReviewInput,
    ticker: string,
  ): Promise<Record<string, unknown>> {
    if (!input.dataframePacket && (!input.chartImages || input.chartImages.length === 0)) {
      return {};
    }

    const hasImages = (input.chartImages?.length ?? 0) > 0;
    const review = await this.modelReview.review({
      reviewType: hasImages ? 'CHART_REVIEW' : 'DATAFRAME_REVIEW',
      targetType: 'technical-review',
      targetId: ticker,
      prompt:
        'Review the setup from dataframe values and optional chart images. ' +
        'Dataframe values are the source of truth for exact levels. Visual review should judge pattern cleanliness only. ' +
        'Return JSON keys: setupType, stage, direction, invalidationLevel, targetArea, riskReward, ' +
        'groupConfirmation, dataframeQualityScore, visualQualityScore, reasons. ' +
        'Keep 620 as timing only, never as a standalone trade setup.',
      payload: {
        hypothesisTitle: input.hypothesisTitle,
        dataframePacket: input.dataframePacket,
      },
      images: input.chartImages,
    });

    if (!review.resultJson || typeof review.resultJson !== 'object') return {};
    return review.resultJson as Record<string, unknown>;
  }

  private resolveStock(stockId?: string, ticker?: string) {
    if (stockId) return this.prisma.stock.findUnique({ where: { id: stockId } });
    if (ticker) {
      return this.prisma.stock.findUnique({
        where: { ticker: ticker.toUpperCase() },
      });
    }
    return Promise.resolve(null);
  }

  private loadActiveSetups(stockId: string) {
    return this.prisma.setup.findMany({
      where: {
        stockId,
        state: { in: ['BUILDING', 'READY', 'TRIGGERED'] },
      },
      orderBy: [{ timeframe: 'asc' }, { detectedAt: 'desc' }],
      take: 5,
    });
  }

  private loadLatestStage(stockId: string) {
    return this.prisma.stockStage.findFirst({
      where: { stockId },
      orderBy: { date: 'desc' },
      select: { stage: true },
    });
  }

  private loadRecentBars(stockId: string) {
    return this.prisma.stockDaily.findMany({
      where: { stockId },
      orderBy: { date: 'desc' },
      take: 80,
    });
  }

  private deriveSetupType(
    input: TechnicalReviewInput,
    setup: Awaited<ReturnType<TechnicalReviewService['loadActiveSetups']>>[number] | undefined,
    modelResult: Record<string, unknown>,
  ): string {
    return (
      this.stringOrUndefined(modelResult.setupType) ??
      input.dataframePacket?.setupLabels?.[0] ??
      setup?.type ??
      'NONE'
    );
  }

  private deriveStage(
    input: TechnicalReviewInput,
    latestStage: StageEnum | undefined,
    bars: Awaited<ReturnType<TechnicalReviewService['loadRecentBars']>>,
    modelResult: Record<string, unknown>,
  ): string {
    const modelStage = this.stringOrUndefined(modelResult.stage);
    if (modelStage) return modelStage;
    if (input.dataframePacket?.stage) return input.dataframePacket.stage;
    if (latestStage) return latestStage;
    const latest = bars[0];
    if (!latest) return 'UNKNOWN';
    const close = Number(latest.close);
    const sma50 = latest.sma50 != null ? Number(latest.sma50) : null;
    const sma200 = latest.sma200 != null ? Number(latest.sma200) : null;
    if (sma50 != null && sma200 != null && close > sma50 && sma50 > sma200) {
      return 'STAGE_2';
    }
    if (sma200 != null && close < sma200) return 'STAGE_4';
    return 'STAGE_1_OR_3';
  }

  private buildKeyLevels(
    input: TechnicalReviewInput,
    setup: Awaited<ReturnType<TechnicalReviewService['loadActiveSetups']>>[number] | undefined,
    latestBar:
      | Awaited<ReturnType<TechnicalReviewService['loadRecentBars']>>[number]
      | undefined,
  ): Record<string, number | null> {
    return {
      pivot:
        setup?.pivotPrice != null
          ? Number(setup.pivotPrice)
          : input.dataframePacket?.nearbyKeyLevels?.pivot ?? null,
      stop:
        setup?.stopPrice != null
          ? Number(setup.stopPrice)
          : input.dataframePacket?.nearbyKeyLevels?.stop ?? null,
      target:
        setup?.targetPrice != null
          ? Number(setup.targetPrice)
          : input.dataframePacket?.nearbyKeyLevels?.target ?? null,
      sma20: latestBar?.sma20 != null ? Number(latestBar.sma20) : null,
      sma50: latestBar?.sma50 != null ? Number(latestBar.sma50) : null,
      sma200: latestBar?.sma200 != null ? Number(latestBar.sma200) : null,
    };
  }

  private deriveEntryArea(
    setup:
      | Awaited<ReturnType<TechnicalReviewService['loadActiveSetups']>>[number]
      | undefined,
    latestPrice: number | null,
    keyLevels: Record<string, number | null>,
  ): { low: number | null; high: number | null } {
    const pivot = setup?.pivotPrice != null ? Number(setup.pivotPrice) : keyLevels.pivot;
    const anchor = pivot ?? latestPrice;
    if (anchor == null) return { low: null, high: null };
    return {
      low: Number((anchor * 0.995).toFixed(2)),
      high: Number((anchor * 1.005).toFixed(2)),
    };
  }

  private deriveTargetArea(
    setup:
      | Awaited<ReturnType<TechnicalReviewService['loadActiveSetups']>>[number]
      | undefined,
    modelResult: Record<string, unknown>,
  ): { low: number | null; high: number | null } {
    const modelTarget = modelResult.targetArea;
    if (modelTarget && typeof modelTarget === 'object' && !Array.isArray(modelTarget)) {
      const obj = modelTarget as Record<string, unknown>;
      return {
        low: this.numberOrNull(obj.low),
        high: this.numberOrNull(obj.high),
      };
    }
    const target = setup?.targetPrice != null ? Number(setup.targetPrice) : null;
    return { low: target, high: target };
  }

  private calculateRiskReward(
    entryArea: { low: number | null; high: number | null },
    invalidationLevel: number | null,
    targetArea: { low: number | null; high: number | null },
  ): number {
    const entry =
      entryArea.low != null && entryArea.high != null
        ? (entryArea.low + entryArea.high) / 2
        : entryArea.low ?? entryArea.high;
    const target = targetArea.high ?? targetArea.low;
    if (entry == null || invalidationLevel == null || target == null) return 0;
    const risk = Math.abs(entry - invalidationLevel);
    if (risk === 0) return 0;
    return Number((Math.abs(target - entry) / risk).toFixed(2));
  }

  private scoreDataframe(
    input: TechnicalReviewInput,
    setupType: string,
    stage: string,
    riskReward: number,
  ): number {
    let score = 35;
    if (setupType !== 'NONE') score += 20;
    if (stage === 'STAGE_2') score += 15;
    if (stage === 'STAGE_4' && BEARISH_SETUPS.has(setupType)) score += 15;
    if ((input.dataframePacket?.volumeRatio ?? 0) >= 1.2) score += 10;
    if (riskReward >= 3) score += 15;
    if ((input.dataframePacket?.possibleViolations?.length ?? 0) > 0) score -= 20;
    return score;
  }

  private deriveDirection(
    setupDirection: Direction | undefined,
    setupType: string,
  ): TechnicalDirection {
    if (setupDirection) return setupDirection;
    if (setupType === 'NONE') return 'WATCH';
    return BEARISH_SETUPS.has(setupType) ? 'SHORT' : 'LONG';
  }

  private buildReasons(
    input: TechnicalReviewInput,
    setupType: string,
    stage: string,
    riskReward: number,
    modelResult: Record<string, unknown>,
  ): string[] {
    const modelReasons = Array.isArray(modelResult.reasons)
      ? modelResult.reasons.filter((item): item is string => typeof item === 'string')
      : [];
    const reasons = [
      `Setup: ${setupType}`,
      `Stage: ${stage}`,
      riskReward > 0 ? `Risk/reward: ${riskReward}R` : 'Risk/reward not established',
      ...(input.dataframePacket?.programEvidence ?? []),
      ...modelReasons,
    ];
    return [...new Set(reasons)];
  }

  private stringOrUndefined(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private numberOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private optionalScore(value: unknown): number | undefined {
    const score = this.numberOrNull(value);
    return score == null ? undefined : this.clampScore(score);
  }

  private clampScore(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
}
