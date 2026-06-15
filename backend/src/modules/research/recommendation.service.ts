import { Injectable, Logger } from '@nestjs/common';
import {
  Direction,
  ExposureMode,
  Prisma,
  RecommendationOutcome,
  SetupType,
  StrategyRecommendation,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateRecommendationInput {
  stockId: string;
  direction: Direction;
  date?: Date;
  themeId?: string;
  groupId?: string;
  setupType?: SetupType;
  entryZone?: { low: number; high: number };
  stopLevel?: number;
  targetLevels?: number[];
  exitPlan?: Record<string, unknown>;
  thesis?: string;
  catalystHypothesisId?: string;
  marketConditionSnapshotId?: string;
  confidenceScore?: number;
  exposureMode?: ExposureMode;
}

/**
 * Persists strategy recommendations and grades their realised outcome against
 * subsequent daily price action (R multiple, max favourable move, stop/target
 * hits). Outcome grading is what closes the learning loop.
 */
@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateRecommendationInput): Promise<StrategyRecommendation> {
    const date = input.date ?? this.today();
    return this.prisma.strategyRecommendation.create({
      data: {
        date,
        stockId: input.stockId,
        themeId: input.themeId ?? null,
        groupId: input.groupId ?? null,
        setupType: input.setupType ?? null,
        direction: input.direction,
        entryZoneJson: this.toJson(input.entryZone),
        stopLevel:
          input.stopLevel != null ? new Prisma.Decimal(input.stopLevel) : null,
        targetLevelsJson: this.toJson(input.targetLevels),
        exitPlanJson: this.toJson(input.exitPlan),
        thesis: input.thesis ?? null,
        catalystHypothesisId: input.catalystHypothesisId ?? null,
        marketConditionSnapshotId: input.marketConditionSnapshotId ?? null,
        confidenceScore:
          input.confidenceScore != null
            ? new Prisma.Decimal(input.confidenceScore)
            : null,
        exposureMode: input.exposureMode ?? 'NORMAL',
      },
    });
  }

  list(limit = 50): Promise<StrategyRecommendation[]> {
    return this.prisma.strategyRecommendation.findMany({
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        stock: { select: { ticker: true, name: true } },
        outcome: true,
      },
    });
  }

  get(id: string): Promise<StrategyRecommendation | null> {
    return this.prisma.strategyRecommendation.findUnique({
      where: { id },
      include: { stock: true, outcome: true },
    });
  }

  /**
   * Grade a recommendation against daily bars after its date.
   * Returns null if there isn't enough data (no entry/stop or no future bars).
   */
  async computeOutcome(
    recommendationId: string,
  ): Promise<RecommendationOutcome | null> {
    const rec = await this.prisma.strategyRecommendation.findUniqueOrThrow({
      where: { id: recommendationId },
    });

    const entry = this.midpoint(rec.entryZoneJson);
    const stop = rec.stopLevel != null ? Number(rec.stopLevel) : null;
    if (entry == null || stop == null) return null;

    const risk = Math.abs(entry - stop);
    if (risk === 0) return null;

    const bars = await this.prisma.stockDaily.findMany({
      where: { stockId: rec.stockId, date: { gt: rec.date } },
      orderBy: { date: 'asc' },
      take: 60,
    });
    if (bars.length === 0) return null;

    const isLong = rec.direction === 'LONG';
    const targets = this.toNumberArray(rec.targetLevelsJson);
    const firstTarget = targets.length ? targets[0] : null;

    let maxR = 0;
    let maxPctMove = 0;
    let daysToMaxR = 0;
    let stoppedOut = false;
    let targetHit = false;

    for (let i = 0; i < bars.length; i++) {
      const high = Number(bars[i].high);
      const low = Number(bars[i].low);

      const favorable = isLong ? high - entry : entry - low;
      const r = favorable / risk;
      if (r > maxR) {
        maxR = r;
        daysToMaxR = i + 1;
      }
      const pct = isLong
        ? ((high - entry) / entry) * 100
        : ((entry - low) / entry) * 100;
      if (pct > maxPctMove) maxPctMove = pct;

      if (firstTarget != null) {
        if (isLong && high >= firstTarget) targetHit = true;
        if (!isLong && low <= firstTarget) targetHit = true;
      }

      const hitStop = isLong ? low <= stop : high >= stop;
      if (hitStop) {
        stoppedOut = true;
        break;
      }
    }

    const lastClose = Number(bars[Math.min(bars.length - 1, daysToMaxR || 0)].close);
    const finalR = stoppedOut ? -1 : (isLong ? lastClose - entry : entry - lastClose) / risk;

    const data = {
      maxR: new Prisma.Decimal(maxR.toFixed(2)),
      maxPctMove: new Prisma.Decimal(maxPctMove.toFixed(2)),
      finalR: new Prisma.Decimal(finalR.toFixed(2)),
      daysToMaxR,
      stoppedOut,
      targetHit,
      setupViolated: stoppedOut && maxR < 0.5,
      bestExitSignal: targetHit ? 'TARGET' : stoppedOut ? 'STOP' : 'TIME',
    };

    return this.prisma.recommendationOutcome.upsert({
      where: { recommendationId },
      create: { recommendationId, ...data },
      update: data,
    });
  }

  private midpoint(json: Prisma.JsonValue | null): number | null {
    if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
    const obj = json as Record<string, unknown>;
    const low = typeof obj.low === 'number' ? obj.low : null;
    const high = typeof obj.high === 'number' ? obj.high : null;
    if (low != null && high != null) return (low + high) / 2;
    if (low != null) return low;
    if (high != null) return high;
    return null;
  }

  private toNumberArray(json: Prisma.JsonValue | null): number[] {
    if (!Array.isArray(json)) return [];
    return json.filter((v): v is number => typeof v === 'number');
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) return undefined;
    return value as Prisma.InputJsonValue;
  }

  private today(): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
}
