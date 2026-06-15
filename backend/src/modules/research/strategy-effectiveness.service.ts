import { Injectable, Logger } from '@nestjs/common';
import { ExposureMode, SetupType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketConditionService } from './market-condition.service';

export interface StrategyEffectivenessOptions {
  lookbackDays?: number;
  minSampleSize?: number;
  setupTypes?: SetupType[];
}

export interface SetupEffectivenessRow {
  setupType: string;
  theme?: string | null;
  maxR: number | null;
  finalR: number | null;
  stoppedOut?: boolean;
  targetHit?: boolean;
  setupViolated?: boolean;
}

export interface SetupEffectivenessStats {
  setupType: string;
  sampleCount: number;
  winRate: number;
  avgMaxR: number;
  avgFinalR: number;
  stopRate: number;
  targetHitRate: number;
  score: number;
}

export interface StrategyEffectivenessReport {
  date: string;
  marketRegime: string;
  workingSetups: string[];
  failingSetups: string[];
  bestThemes: string[];
  setupStats: Record<string, SetupEffectivenessStats>;
  recommendedExposureMode: Exclude<ExposureMode, 'MARGIN_ALLOWED'>;
  notes: string;
}

export function summarizeEffectivenessRows(
  rows: SetupEffectivenessRow[],
): Record<string, SetupEffectivenessStats> {
  const grouped = new Map<string, SetupEffectivenessRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.setupType) ?? [];
    list.push(row);
    grouped.set(row.setupType, list);
  }

  const result: Record<string, SetupEffectivenessStats> = {};
  for (const [setupType, list] of grouped) {
    const sampleCount = list.length;
    const finalRs = list.map((row) => row.finalR ?? 0);
    const maxRs = list.map((row) => row.maxR ?? 0);
    const wins = finalRs.filter((value) => value > 0).length;
    const stopCount = list.filter((row) => row.stoppedOut || row.setupViolated).length;
    const targetCount = list.filter((row) => row.targetHit).length;
    const winRate = sampleCount ? wins / sampleCount : 0;
    const avgFinalR = average(finalRs);
    const avgMaxR = average(maxRs);
    const stopRate = sampleCount ? stopCount / sampleCount : 0;
    const targetHitRate = sampleCount ? targetCount / sampleCount : 0;
    const score = Math.round(
      avgFinalR * 35 + avgMaxR * 20 + winRate * 30 + targetHitRate * 15 - stopRate * 20,
    );

    result[setupType] = {
      setupType,
      sampleCount,
      winRate: round2(winRate),
      avgMaxR: round2(avgMaxR),
      avgFinalR: round2(avgFinalR),
      stopRate: round2(stopRate),
      targetHitRate: round2(targetHitRate),
      score,
    };
  }
  return result;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

@Injectable()
export class StrategyEffectivenessService {
  private readonly logger = new Logger(StrategyEffectivenessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketCondition: MarketConditionService,
  ) {}

  async report(
    options: StrategyEffectivenessOptions = {},
  ): Promise<StrategyEffectivenessReport> {
    const lookbackDays = options.lookbackDays ?? 90;
    const minSampleSize = options.minSampleSize ?? 3;
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - lookbackDays);
    from.setUTCHours(0, 0, 0, 0);

    const [setupRows, recommendationRows, condition] = await Promise.all([
      this.loadSetupOutcomeRows(from, options.setupTypes),
      this.loadRecommendationOutcomeRows(from, options.setupTypes),
      this.marketCondition.getLatest('TRADABLE_UNIVERSE', 'ALL'),
    ]);

    const rows = [...setupRows, ...recommendationRows];
    const setupStats = summarizeEffectivenessRows(rows);
    const ranked = Object.values(setupStats)
      .filter((stat) => stat.sampleCount >= minSampleSize)
      .sort((a, b) => b.score - a.score);

    const workingSetups = ranked
      .filter((stat) => stat.score > 35 && stat.avgFinalR > 0)
      .slice(0, 5)
      .map((stat) => stat.setupType);
    const failingSetups = [...ranked]
      .reverse()
      .filter((stat) => stat.score < 10 || stat.avgFinalR < 0)
      .slice(0, 5)
      .map((stat) => stat.setupType);

    return {
      date: new Date().toISOString().slice(0, 10),
      marketRegime: condition?.summary ?? 'Market condition not computed',
      workingSetups,
      failingSetups,
      bestThemes: this.rankThemes(rows).slice(0, 5),
      setupStats,
      recommendedExposureMode: this.recommendExposure(ranked, condition?.summary),
      notes: this.buildNotes(rows.length, lookbackDays, minSampleSize),
    };
  }

  private async loadSetupOutcomeRows(
    from: Date,
    setupTypes?: SetupType[],
  ): Promise<SetupEffectivenessRow[]> {
    const rows = await this.prisma.setupOutcome.findMany({
      where: {
        effectiveDate: { gte: from },
        ...(setupTypes?.length ? { setupType: { in: setupTypes } } : {}),
      },
      select: {
        setupType: true,
        maxR: true,
        finalR: true,
        isWin: true,
        metadata: true,
      },
    });

    return rows.map((row) => ({
      setupType: row.setupType,
      maxR: row.maxR != null ? Number(row.maxR) : null,
      finalR: row.finalR != null ? Number(row.finalR) : null,
      stoppedOut: row.isWin === false,
      targetHit: (row.maxR != null ? Number(row.maxR) : 0) >= 3,
      setupViolated: this.metadataBoolean(row.metadata, 'setupViolated'),
    }));
  }

  private async loadRecommendationOutcomeRows(
    from: Date,
    setupTypes?: SetupType[],
  ): Promise<SetupEffectivenessRow[]> {
    const rows = await this.prisma.strategyRecommendation.findMany({
      where: {
        date: { gte: from },
        setupType: setupTypes?.length ? { in: setupTypes } : { not: null },
        outcome: { isNot: null },
      },
      include: {
        theme: { select: { name: true } },
        outcome: true,
      },
    });

    return rows
      .filter((row) => row.setupType != null && row.outcome != null)
      .map((row) => ({
        setupType: row.setupType as string,
        theme: row.theme?.name ?? null,
        maxR: row.outcome?.maxR != null ? Number(row.outcome.maxR) : null,
        finalR: row.outcome?.finalR != null ? Number(row.outcome.finalR) : null,
        stoppedOut: row.outcome?.stoppedOut ?? false,
        targetHit: row.outcome?.targetHit ?? false,
        setupViolated: row.outcome?.setupViolated ?? false,
      }));
  }

  private rankThemes(rows: SetupEffectivenessRow[]): string[] {
    const grouped = new Map<string, number[]>();
    for (const row of rows) {
      if (!row.theme) continue;
      const list = grouped.get(row.theme) ?? [];
      list.push(row.finalR ?? 0);
      grouped.set(row.theme, list);
    }
    return [...grouped.entries()]
      .map(([theme, values]) => ({ theme, score: average(values), count: values.length }))
      .filter((item) => item.count >= 2)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.theme);
  }

  private recommendExposure(
    ranked: SetupEffectivenessStats[],
    marketSummary?: string | null,
  ): Exclude<ExposureMode, 'MARGIN_ALLOWED'> {
    const top = ranked[0];
    const summary = marketSummary?.toLowerCase() ?? '';
    if (summary.includes('stayout') || summary.includes('distribution')) {
      return 'STAY_OUT';
    }
    if (!top || top.sampleCount < 3 || top.avgFinalR <= 0) return 'WATER_TEST';
    if (top.score >= 80 && top.winRate >= 0.55) return 'AGGRESSIVE';
    if (top.score >= 35) return 'NORMAL';
    return 'WATER_TEST';
  }

  private buildNotes(
    sampleCount: number,
    lookbackDays: number,
    minSampleSize: number,
  ): string {
    if (sampleCount === 0) {
      return `No stored setup or recommendation outcomes in the last ${lookbackDays} days. Run outcome grading before trusting strategy effectiveness.`;
    }
    return `Based on ${sampleCount} stored outcomes over ${lookbackDays} days; setup rankings require at least ${minSampleSize} samples.`;
  }

  private metadataBoolean(metadata: unknown, key: string): boolean {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return false;
    }
    return (metadata as Record<string, unknown>)[key] === true;
  }
}
