import { Injectable, Logger } from '@nestjs/common';
import {
  MarketConditionSnapshot,
  MarketScopeType,
  Prisma,
  SetupOutcomeSource,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { detectSignificantSwingPoints } from '../setup/primitives';
import type { Bar } from '../../common/types';

const STRUCTURE_LOOKBACK_BARS = 80;
const SETUP_PERFORMANCE_WINDOW_DAYS = 60;
const R_TARGETS = [2, 3, 4] as const;
const EQUAL_WEIGHT_PAIRS = [
  { cap: 'SPY', equal: 'RSP' },
  { cap: 'QQQ', equal: 'QQQE' },
] as const;

type StructureTrend = 'UPTREND' | 'DOWNTREND' | 'RANGE' | 'UNKNOWN';
type DivergenceState =
  | 'BULLISH_CONFIRMATION'
  | 'BEARISH_CONFIRMATION'
  | 'BEARISH_DIVERGENCE'
  | 'BULLISH_DIVERGENCE'
  | 'MIXED'
  | 'UNKNOWN';

interface SeriesPoint {
  date: Date;
  value: number;
}

interface StructureSwing {
  date: string;
  index: number;
  price: number;
}

interface TrendlineSummary {
  type: 'UPTREND_SUPPORT' | 'DOWNTREND_RESISTANCE';
  slope: number;
  start: StructureSwing;
  end: StructureSwing;
  projectedCurrent: number;
  currentValue: number;
  currentPosition: 'ABOVE' | 'BELOW' | 'ON';
}

export interface StructureSummary {
  trend: StructureTrend;
  latestValue: number | null;
  higherLow: boolean;
  lowerLow: boolean;
  higherHigh: boolean;
  lowerHigh: boolean;
  risingTrendline: boolean;
  fallingTrendline: boolean;
  trendline: TrendlineSummary | null;
  swingHighs: StructureSwing[];
  swingLows: StructureSwing[];
  reason: string;
}

interface DivergenceInput {
  cap: StructureSummary;
  equal?: StructureSummary | null;
  breadth?: StructureSummary | null;
}

export function classifyStructureDivergence(input: DivergenceInput): DivergenceState {
  const capUp = isStructurallyUp(input.cap);
  const capDown = isStructurallyDown(input.cap);
  const equalUp = input.equal ? isStructurallyUp(input.equal) : false;
  const equalDown = input.equal ? isStructurallyDown(input.equal) : false;
  const breadthUp = input.breadth ? isStructurallyUp(input.breadth) : false;
  const breadthDown = input.breadth ? isStructurallyDown(input.breadth) : false;

  if (input.cap.trend === 'UNKNOWN') return 'UNKNOWN';
  if (capUp && equalUp && breadthUp) return 'BULLISH_CONFIRMATION';
  if (capDown && equalDown && breadthDown) return 'BEARISH_CONFIRMATION';
  if (capUp && (equalDown || breadthDown)) return 'BEARISH_DIVERGENCE';
  if (capDown && (equalUp || breadthUp)) return 'BULLISH_DIVERGENCE';
  return 'MIXED';
}

function isStructurallyUp(summary: StructureSummary): boolean {
  return summary.trend === 'UPTREND' || summary.higherLow || summary.risingTrendline;
}

function isStructurallyDown(summary: StructureSummary): boolean {
  return summary.trend === 'DOWNTREND' || summary.lowerHigh || summary.fallingTrendline;
}

export function analyzeNumericStructure(
  points: SeriesPoint[],
  minSwingCount = 3,
): StructureSummary {
  const clean = points
    .filter((point) => Number.isFinite(point.value))
    .slice(-STRUCTURE_LOOKBACK_BARS);

  if (clean.length < 10) {
    return emptyStructure(clean.at(-1)?.value ?? null, 'not_enough_points');
  }

  const swings = detectNumericSwings(clean);
  return summarizeStructure(clean, swings.highs, swings.lows, minSwingCount);
}

function analyzeBarStructure(
  bars: Array<{ date: Date; open: Prisma.Decimal; high: Prisma.Decimal; low: Prisma.Decimal; close: Prisma.Decimal }>,
): StructureSummary {
  const recent = bars.slice(-STRUCTURE_LOOKBACK_BARS);
  if (recent.length < 10) {
    return emptyStructure(
      recent.at(-1) ? Number(recent.at(-1)?.close) : null,
      'not_enough_bars',
    );
  }

  const mapped: Bar[] = recent.map((bar) => ({
    date: bar.date,
    open: Number(bar.open),
    high: Number(bar.high),
    low: Number(bar.low),
    close: Number(bar.close),
    volume: 0,
  }));
  const atrSwings = detectSignificantSwingPoints(mapped, {
    left: 3,
    right: 3,
    promAtr: 0.8,
    departAtr: 1.2,
    departLookahead: 8,
    minSwingSep: 4,
  });

  const swingHighs = atrSwings
    .filter((swing) => swing.type === 'HIGH')
    .map((swing) => toStructureSwing(recent[swing.index].date, swing.index, swing.price));
  const swingLows = atrSwings
    .filter((swing) => swing.type === 'LOW')
    .map((swing) => toStructureSwing(recent[swing.index].date, swing.index, swing.price));

  if (swingHighs.length + swingLows.length >= 3) {
    return summarizeStructure(
      recent.map((bar) => ({ date: bar.date, value: Number(bar.close) })),
      swingHighs,
      swingLows,
      3,
    );
  }

  const fallback = detectNumericSwings(
    recent.map((bar) => ({ date: bar.date, value: Number(bar.close) })),
  );
  return summarizeStructure(
    recent.map((bar) => ({ date: bar.date, value: Number(bar.close) })),
    fallback.highs,
    fallback.lows,
    3,
  );
}

function emptyStructure(latestValue: number | null, reason: string): StructureSummary {
  return {
    trend: 'UNKNOWN',
    latestValue,
    higherLow: false,
    lowerLow: false,
    higherHigh: false,
    lowerHigh: false,
    risingTrendline: false,
    fallingTrendline: false,
    trendline: null,
    swingHighs: [],
    swingLows: [],
    reason,
  };
}

function detectNumericSwings(points: SeriesPoint[]): {
  highs: StructureSwing[];
  lows: StructureSwing[];
} {
  const values = points.map((point) => point.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const minMove = Math.max((max - min) * 0.03, 0.0001);
  const highs: StructureSwing[] = [];
  const lows: StructureSwing[] = [];

  for (let index = 2; index < points.length - 2; index++) {
    const prev = values.slice(index - 2, index);
    const next = values.slice(index + 1, index + 3);
    const value = values[index];
    if (
      prev.every((candidate) => value >= candidate) &&
      next.every((candidate) => value > candidate) &&
      value - Math.min(...prev, ...next) >= minMove
    ) {
      highs.push(toStructureSwing(points[index].date, index, value));
    }
    if (
      prev.every((candidate) => value <= candidate) &&
      next.every((candidate) => value < candidate) &&
      Math.max(...prev, ...next) - value >= minMove
    ) {
      lows.push(toStructureSwing(points[index].date, index, value));
    }
  }

  return {
    highs: dedupeSwings(highs, 'HIGH'),
    lows: dedupeSwings(lows, 'LOW'),
  };
}

function dedupeSwings(swings: StructureSwing[], type: 'HIGH' | 'LOW'): StructureSwing[] {
  const result: StructureSwing[] = [];
  for (const swing of swings) {
    const last = result[result.length - 1];
    if (!last || swing.index - last.index > 4) {
      result.push(swing);
      continue;
    }
    const keepNew = type === 'HIGH' ? swing.price > last.price : swing.price < last.price;
    if (keepNew) result[result.length - 1] = swing;
  }
  return result;
}

function summarizeStructure(
  points: SeriesPoint[],
  swingHighs: StructureSwing[],
  swingLows: StructureSwing[],
  minSwingCount: number,
): StructureSummary {
  const latestValue = points.at(-1)?.value ?? null;
  if (swingHighs.length + swingLows.length < minSwingCount) {
    return {
      ...emptyStructure(latestValue, 'insufficient_confirmed_swings'),
      swingHighs,
      swingLows,
    };
  }

  const lastTwoHighs = swingHighs.slice(-2);
  const lastTwoLows = swingLows.slice(-2);
  const higherHigh = lastTwoHighs.length === 2 && lastTwoHighs[1].price > lastTwoHighs[0].price;
  const lowerHigh = lastTwoHighs.length === 2 && lastTwoHighs[1].price < lastTwoHighs[0].price;
  const higherLow = lastTwoLows.length === 2 && lastTwoLows[1].price > lastTwoLows[0].price;
  const lowerLow = lastTwoLows.length === 2 && lastTwoLows[1].price < lastTwoLows[0].price;

  let trend: StructureTrend = 'RANGE';
  if (higherLow && (higherHigh || !lowerHigh)) trend = 'UPTREND';
  if (lowerHigh && (lowerLow || !higherLow)) trend = 'DOWNTREND';

  const trendline = buildTrendline(
    trend === 'DOWNTREND' ? lastTwoHighs : lastTwoLows,
    trend === 'DOWNTREND' ? 'DOWNTREND_RESISTANCE' : 'UPTREND_SUPPORT',
    points.length - 1,
    latestValue,
  );

  return {
    trend,
    latestValue,
    higherLow,
    lowerLow,
    higherHigh,
    lowerHigh,
    risingTrendline: (trendline?.slope ?? 0) > 0,
    fallingTrendline: (trendline?.slope ?? 0) < 0,
    trendline,
    swingHighs,
    swingLows,
    reason: trend.toLowerCase(),
  };
}

function buildTrendline(
  anchors: StructureSwing[],
  type: TrendlineSummary['type'],
  currentIndex: number,
  currentValue: number | null,
): TrendlineSummary | null {
  if (anchors.length < 2 || currentValue == null) return null;
  const [start, end] = anchors;
  const denominator = end.index - start.index;
  if (denominator === 0) return null;
  const slope = (end.price - start.price) / denominator;
  const projectedCurrent = end.price + slope * (currentIndex - end.index);
  const delta = currentValue - projectedCurrent;
  const tolerance = Math.max(Math.abs(currentValue) * 0.0025, 0.0001);
  return {
    type,
    slope: round(slope, 4),
    start,
    end,
    projectedCurrent: round(projectedCurrent, 2),
    currentValue: round(currentValue, 2),
    currentPosition: Math.abs(delta) <= tolerance ? 'ON' : delta > 0 ? 'ABOVE' : 'BELOW',
  };
}

function toStructureSwing(date: Date, index: number, price: number): StructureSwing {
  return {
    date: date.toISOString().slice(0, 10),
    index,
    price: round(price, 2),
  };
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// ── Pure trend helpers (no DB) ──

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function isRising(values: number[], lookback: number): boolean {
  if (values.length <= lookback) return false;
  return values[values.length - 1] > values[values.length - 1 - lookback];
}

export interface TrendFlags {
  longTermTrendingUp: boolean;
  longTermTrendingDown: boolean;
  longTermRanging: boolean;
  longTermRangeHigh: number | null;
  longTermRangeLow: number | null;
  midTermTrendingUp: boolean;
  midTermTrendingDown: boolean;
  midTermRanging: boolean;
  midTermExtended: boolean;
  midTermPullback: boolean;
  shortTermTrendingUp: boolean;
  shortTermTrendingDown: boolean;
  shortTermRanging: boolean;
  shortTermExtended: boolean;
  shortTermOversold: boolean;
  trendScore: number;
}

/**
 * Derive multi-timeframe trend flags from a series of closing prices.
 * Long term keys off the 200MA, mid term off the 50MA, short term off the 20MA.
 */
export function computeTrendFlags(closes: number[]): TrendFlags {
  const flags: TrendFlags = {
    longTermTrendingUp: false,
    longTermTrendingDown: false,
    longTermRanging: false,
    longTermRangeHigh: null,
    longTermRangeLow: null,
    midTermTrendingUp: false,
    midTermTrendingDown: false,
    midTermRanging: false,
    midTermExtended: false,
    midTermPullback: false,
    shortTermTrendingUp: false,
    shortTermTrendingDown: false,
    shortTermRanging: false,
    shortTermExtended: false,
    shortTermOversold: false,
    trendScore: 50,
  };
  if (closes.length === 0) return flags;

  const last = closes[closes.length - 1];
  const sma200 = sma(closes, 200);
  const sma50 = sma(closes, 50);
  const sma20 = sma(closes, 20);

  // Long term (200MA)
  if (sma200 != null) {
    const rising = isRising(closes.slice(-200).length >= 200 ? closes : closes, 20);
    if (last > sma200 && rising) flags.longTermTrendingUp = true;
    else if (last < sma200 && !rising) flags.longTermTrendingDown = true;
    else flags.longTermRanging = true;
    const window = closes.slice(-200);
    flags.longTermRangeHigh = Math.max(...window);
    flags.longTermRangeLow = Math.min(...window);
  } else {
    flags.longTermRanging = true;
  }

  // Mid term (50MA)
  if (sma50 != null) {
    const rising = isRising(closes, 10);
    if (last > sma50 && rising) flags.midTermTrendingUp = true;
    else if (last < sma50 && !rising) flags.midTermTrendingDown = true;
    else flags.midTermRanging = true;
    if (last > sma50 * 1.1) flags.midTermExtended = true;
    if (last >= sma50 * 0.97 && last <= sma50 * 1.03 && flags.longTermTrendingUp) {
      flags.midTermPullback = true;
    }
  } else {
    flags.midTermRanging = true;
  }

  // Short term (20MA)
  if (sma20 != null) {
    const rising = isRising(closes, 5);
    if (last > sma20 && rising) flags.shortTermTrendingUp = true;
    else if (last < sma20 && !rising) flags.shortTermTrendingDown = true;
    else flags.shortTermRanging = true;
    if (last > sma20 * 1.05) flags.shortTermExtended = true;
    if (last < sma20 * 0.95) flags.shortTermOversold = true;
  } else {
    flags.shortTermRanging = true;
  }

  // Trend score: weighted vote of the three timeframes (0-100)
  let score = 50;
  score += flags.longTermTrendingUp ? 20 : flags.longTermTrendingDown ? -20 : 0;
  score += flags.midTermTrendingUp ? 15 : flags.midTermTrendingDown ? -15 : 0;
  score += flags.shortTermTrendingUp ? 10 : flags.shortTermTrendingDown ? -10 : 0;
  flags.trendScore = Math.max(0, Math.min(100, score));

  return flags;
}

interface BreadthFlags {
  breadthConfirming: boolean;
  breadthDiverging: boolean;
  breadthImproving: boolean;
  breadthDeteriorating: boolean;
  breadthScore: number;
}

interface LeaderFlags {
  leadersAdvancing: boolean;
  leadersBasing: boolean;
  leadersFailing: boolean;
  leadersExtended: boolean;
  leadersRotating: boolean;
  leaderScore: number;
}

interface TrendDetailJson {
  longTerm: { state: 'UP' | 'DOWN' | 'RANGE'; scoreContribution: number; rangeHigh: number | null; rangeLow: number | null };
  midTerm: { state: 'UP' | 'DOWN' | 'RANGE'; scoreContribution: number; extended: boolean; pullback: boolean };
  shortTerm: { state: 'UP' | 'DOWN' | 'RANGE'; scoreContribution: number; extended: boolean; oversold: boolean };
  score: number;
}

interface BreadthContext {
  flags: BreadthFlags;
  structure: {
    latest: {
      date: string | null;
      naad: number | null;
      nahl: number | null;
      naa50r: number | null;
      naa200r: number | null;
    };
    naad: StructureSummary;
    nahlState: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'UNKNOWN';
    naa50rState: 'ABOVE_50' | 'BELOW_50' | 'UNKNOWN';
    naa200rState: 'ABOVE_50' | 'BELOW_50' | 'UNKNOWN';
  };
}

interface SetupPerformanceTargetSummary {
  targetR: number;
  sampleCount: number;
  hits: number;
  winRate: number | null;
  averageHoldingDays: number | null;
  medianHoldingDays: number | null;
  percentGainDistribution: DistributionBin[];
}

interface SetupPerformanceGroup {
  key: string;
  family: string;
  setupType: string;
  direction: string;
  sampleCount: number;
  sourceCounts: SetupPerformanceSourceCounts;
  stopLossRate: number | null;
  targets: SetupPerformanceTargetSummary[];
  outcomeDistribution: DistributionBin[];
  maxRDistribution: DistributionBin[];
}

interface SetupPerformanceSourceCounts {
  live: number;
  simulated: number;
  total: number;
}

interface SetupPerformanceSummary {
  windowDays: number;
  sampleCount: number;
  sourceCounts: SetupPerformanceSourceCounts;
  periods: SetupPerformancePeriodSummary[];
  groups: SetupPerformanceGroup[];
}

interface DistributionBin {
  label: string;
  count: number;
  pct: number;
}

interface SetupPerformancePeriodSummary {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  sampleCount: number;
  sourceCounts: SetupPerformanceSourceCounts;
  groups: SetupPerformanceGroup[];
  outcomeDistribution: DistributionBin[];
}

type RTargetMetadata = Record<
  string,
  {
    hit?: boolean;
    hitDate?: string | null;
    daysToHit?: number | null;
    pctMove?: number | null;
  }
>;

type SetupOutcomeForAggregation = {
  source: SetupOutcomeSource;
  family: string;
  setupType: string;
  direction: string;
  effectiveDate: Date;
  maxR: Prisma.Decimal | number | null;
  finalR: Prisma.Decimal | number | null;
  metadata: Prisma.JsonValue | null;
};

export function buildSetupPerformanceSummary(
  rows: SetupOutcomeForAggregation[],
  windowDays = SETUP_PERFORMANCE_WINDOW_DAYS,
): SetupPerformanceSummary {
  const groupSummaries = buildSetupGroupSummaries(rows);

  return {
    windowDays,
    sampleCount: rows.length,
    sourceCounts: buildSourceCounts(rows),
    periods: buildPeriodSummaries(rows),
    groups: groupSummaries,
  };
}

function buildSetupGroupSummaries(
  rows: SetupOutcomeForAggregation[],
): SetupPerformanceGroup[] {
  const groups = new Map<string, SetupOutcomeForAggregation[]>();
  for (const row of rows) {
    const key = `${row.family}:${row.setupType}:${row.direction}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  const groupSummaries = Array.from(groups.entries())
    .map(([key, bucket]) => {
      const [family, setupType, direction] = key.split(':');
      const stopCount = bucket.filter((row) => didStopOut(row)).length;
      const maxRValues = bucket
        .map((row) => toFiniteNumber(row.maxR))
        .filter((value): value is number => value != null);

      return {
        key,
        family,
        setupType,
        direction,
        sampleCount: bucket.length,
        sourceCounts: buildSourceCounts(bucket),
        stopLossRate: bucket.length > 0 ? round(stopCount / bucket.length, 3) : null,
        targets: R_TARGETS.map((targetR) => summarizeTarget(bucket, targetR)),
        outcomeDistribution: buildOutcomeDistribution(bucket),
        maxRDistribution: buildDistribution(maxRValues, [
          { label: '<0R', max: 0 },
          { label: '0-1R', max: 1 },
          { label: '1-2R', max: 2 },
          { label: '2-3R', max: 3 },
          { label: '3-4R', max: 4 },
          { label: '4R+', max: Infinity },
        ]),
      };
    })
    .sort((a, b) => b.sampleCount - a.sampleCount);

  return groupSummaries;
}

function summarizeTarget(
  rows: SetupOutcomeForAggregation[],
  targetR: number,
): SetupPerformanceTargetSummary {
  const hits = rows
    .map((row) => getTargetMetadata(row, targetR))
    .filter((target) => target.hit);
  const holdingDays = hits
    .map((target) => target.daysToHit)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const pctMoves = hits
    .map((target) => target.pctMove)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return {
    targetR,
    sampleCount: rows.length,
    hits: hits.length,
    winRate: rows.length > 0 ? round(hits.length / rows.length, 3) : null,
    averageHoldingDays: holdingDays.length > 0 ? round(average(holdingDays), 1) : null,
    medianHoldingDays: holdingDays.length > 0 ? round(median(holdingDays), 1) : null,
    percentGainDistribution: buildDistribution(pctMoves, [
      { label: '<0%', max: 0 },
      { label: '0-5%', max: 5 },
      { label: '5-10%', max: 10 },
      { label: '10-20%', max: 20 },
      { label: '20%+', max: Infinity },
    ]),
  };
}

function getTargetMetadata(
  row: SetupOutcomeForAggregation,
  targetR: number,
): { hit: boolean; daysToHit: number | null; pctMove: number | null } {
  const metadata = toRecord(row.metadata);
  const rTargets = toRecord(metadata.rTargets) as RTargetMetadata | null;
  const target = rTargets?.[String(targetR)];
  const maxR = toFiniteNumber(row.maxR);
  return {
    hit: Boolean(target?.hit) || (maxR != null && maxR >= targetR),
    daysToHit:
      typeof target?.daysToHit === 'number' && Number.isFinite(target.daysToHit)
        ? target.daysToHit
        : null,
    pctMove:
      typeof target?.pctMove === 'number' && Number.isFinite(target.pctMove)
        ? target.pctMove
        : null,
  };
}

function didStopOut(row: SetupOutcomeForAggregation): boolean {
  const metadata = toRecord(row.metadata);
  const stopHit = toRecord(metadata.stopHit);
  if (stopHit && stopHit.hit === true) return true;
  const finalR = toFiniteNumber(row.finalR);
  return finalR != null && finalR <= -0.95;
}

function buildOutcomeDistribution(rows: SetupOutcomeForAggregation[]): DistributionBin[] {
  const counts = [
    { label: 'Stop', count: 0, pct: 0 },
    { label: '<2R', count: 0, pct: 0 },
    { label: '2-3R', count: 0, pct: 0 },
    { label: '3-4R', count: 0, pct: 0 },
    { label: '4R+', count: 0, pct: 0 },
  ];

  for (const row of rows) {
    const maxR = toFiniteNumber(row.maxR) ?? 0;
    const stoppedBeforeTakingProfit = didStopOut(row) && maxR < 2;
    if (stoppedBeforeTakingProfit) {
      counts[0].count++;
    } else if (maxR < 2) {
      counts[1].count++;
    } else if (maxR < 3) {
      counts[2].count++;
    } else if (maxR < 4) {
      counts[3].count++;
    } else {
      counts[4].count++;
    }
  }

  return counts.map((bin) => ({
    ...bin,
    pct: rows.length > 0 ? round(bin.count / rows.length, 3) : 0,
  }));
}

function buildPeriodSummaries(
  rows: SetupOutcomeForAggregation[],
): SetupPerformancePeriodSummary[] {
  const grouped = new Map<string, SetupOutcomeForAggregation[]>();
  for (const row of rows) {
    const start = startOfUtcWeek(row.effectiveDate);
    const key = formatDate(start);
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, bucket]) => {
      const start = new Date(`${key}T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 6);
      return {
        key,
        label: key,
        startDate: key,
        endDate: formatDate(end),
        sampleCount: bucket.length,
        sourceCounts: buildSourceCounts(bucket),
        groups: buildSetupGroupSummaries(bucket),
        outcomeDistribution: buildOutcomeDistribution(bucket),
      };
    });
}

function buildSourceCounts(
  rows: SetupOutcomeForAggregation[],
): SetupPerformanceSourceCounts {
  const live = rows.filter((row) => row.source === SetupOutcomeSource.LIVE).length;
  const simulated = rows.filter(
    (row) => row.source === SetupOutcomeSource.SIMULATED,
  ).length;
  return {
    live,
    simulated,
    total: rows.length,
  };
}

function startOfUtcWeek(date: Date): Date {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  const day = value.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setUTCDate(value.getUTCDate() + diff);
  return value;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildDistribution(
  values: number[],
  bins: Array<{ label: string; max: number }>,
): DistributionBin[] {
  const counts = bins.map((bin) => ({ label: bin.label, count: 0, pct: 0 }));
  for (const value of values) {
    const index = bins.findIndex((bin) => value < bin.max);
    counts[index === -1 ? counts.length - 1 : index].count++;
  }
  return counts.map((bin) => ({
    ...bin,
    pct: values.length > 0 ? round(bin.count / values.length, 3) : 0,
  }));
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[midpoint];
  return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toFiniteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Computes multi-timeframe market condition snapshots (flags + scores) for
 * indexes and the leader/tradable universes. Pure trend math is testable via
 * `computeTrendFlags`; breadth/leader inputs come from existing snapshots.
 */
@Injectable()
export class MarketConditionService {
  private readonly logger = new Logger(MarketConditionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Rebuild snapshots for the latest available date: one per index plus a
   * leader-universe and tradable-universe aggregate. Returns count written.
   */
  async rebuild(): Promise<number> {
    const breadth = await this.getBreadthContext();
    const leaders = await this.getLeaderFlags();
    const setupPerformance = await this.getSetupPerformance();

    const indices = await this.prisma.indexEntity.findMany({
      include: {
        dailyBars: { orderBy: { date: 'desc' }, take: 220 },
      },
    });

    let written = 0;
    let latestDate = new Date();
    latestDate.setUTCHours(0, 0, 0, 0);

    for (const index of indices) {
      if (index.dailyBars.length === 0) continue;
      const ordered = [...index.dailyBars].reverse();
      const closes = ordered.map((b) => Number(b.close));
      const date = ordered[ordered.length - 1].date;
      latestDate = date;
      const trend = computeTrendFlags(closes);
      const capStructure = analyzeBarStructure(ordered);
      const equalWeightStructure = await this.buildEqualWeightStructure(
        index.ticker,
        capStructure,
        breadth.structure.naad,
      );
      const breadthStructure = this.buildBreadthStructure(
        index.ticker,
        capStructure,
        breadth,
        equalWeightStructure.primaryDivergence,
      );
      await this.persist(
        date,
        'INDEX',
        index.ticker,
        trend,
        breadth.flags,
        leaders,
        buildTrendDetail(trend),
        breadthStructure,
        this.toInputJson(equalWeightStructure),
        setupPerformance,
      );
      written++;
    }

    // Universe-level aggregates use the same breadth/leader signals with a
    // neutral trend baseline (universe has no single price series).
    const neutralTrend = computeTrendFlags([]);
    await this.persist(
      latestDate,
      'LEADER_UNIVERSE',
      'ALL',
      neutralTrend,
      breadth.flags,
      leaders,
      buildTrendDetail(neutralTrend),
      this.buildBreadthStructure('ALL', null, breadth, 'UNKNOWN'),
      this.toInputJson({
        pairs: [],
        primaryDivergence: 'UNKNOWN',
        reason: 'no_single_price_series',
      }),
      setupPerformance,
    );
    await this.persist(
      latestDate,
      'TRADABLE_UNIVERSE',
      'ALL',
      neutralTrend,
      breadth.flags,
      leaders,
      buildTrendDetail(neutralTrend),
      this.buildBreadthStructure('ALL', null, breadth, 'UNKNOWN'),
      this.toInputJson({
        pairs: [],
        primaryDivergence: 'UNKNOWN',
        reason: 'no_single_price_series',
      }),
      setupPerformance,
    );
    written += 2;

    this.logger.log(`Market condition: wrote ${written} snapshots`);
    return written;
  }

  getLatest(
    scopeType: MarketScopeType = 'INDEX',
    scopeKey?: string,
  ): Promise<MarketConditionSnapshot | null> {
    return this.prisma.marketConditionSnapshot.findFirst({
      where: { scopeType, ...(scopeKey ? { scopeKey } : {}) },
      orderBy: { date: 'desc' },
    });
  }

  getLatestAll(): Promise<MarketConditionSnapshot[]> {
    return this.prisma.marketConditionSnapshot.findMany({
      orderBy: { date: 'desc' },
      take: 20,
    });
  }

  getHistory(
    scopeType: MarketScopeType,
    scopeKey: string,
    limit = 60,
  ): Promise<MarketConditionSnapshot[]> {
    return this.prisma.marketConditionSnapshot.findMany({
      where: { scopeType, scopeKey },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  // ── Internal derivation ──

  private async getBreadthContext(): Promise<BreadthContext> {
    const snaps = await this.prisma.breadthSnapshot.findMany({
      orderBy: { date: 'desc' },
      take: 120,
    });
    const flags: BreadthFlags = {
      breadthConfirming: false,
      breadthDiverging: false,
      breadthImproving: false,
      breadthDeteriorating: false,
      breadthScore: 50,
    };
    if (snaps.length === 0) {
      return {
        flags,
        structure: {
          latest: {
            date: null,
            naad: null,
            nahl: null,
            naa50r: null,
            naa200r: null,
          },
          naad: emptyStructure(null, 'no_breadth_snapshots'),
          nahlState: 'UNKNOWN',
          naa50rState: 'UNKNOWN',
          naa200rState: 'UNKNOWN',
        },
      };
    }

    const latest = snaps[0];
    const previous = snaps[1];
    const naa50r = latest.naa50r != null ? Number(latest.naa50r) : null;
    const naa200r = latest.naa200r != null ? Number(latest.naa200r) : null;
    const nahl = latest.nahl != null ? Number(latest.nahl) : null;
    if (naa50r != null) {
      flags.breadthConfirming = naa50r >= 50;
      flags.breadthDiverging = naa50r < 40;
      flags.breadthScore = Math.max(0, Math.min(100, naa50r));
    }
    if (previous?.naa50r != null && naa50r != null) {
      const prev = Number(previous.naa50r);
      flags.breadthImproving = naa50r > prev;
      flags.breadthDeteriorating = naa50r < prev;
    }

    const ordered = [...snaps].reverse();
    const naadPoints = ordered
      .filter((snapshot) => snapshot.naad != null)
      .map((snapshot) => ({ date: snapshot.date, value: Number(snapshot.naad) }));

    return {
      flags,
      structure: {
        latest: {
          date: latest.date.toISOString().slice(0, 10),
          naad: latest.naad != null ? Number(latest.naad) : null,
          nahl,
          naa50r,
          naa200r,
        },
        naad: analyzeNumericStructure(naadPoints),
        nahlState:
          nahl == null ? 'UNKNOWN' : nahl > 0 ? 'POSITIVE' : nahl < 0 ? 'NEGATIVE' : 'NEUTRAL',
        naa50rState:
          naa50r == null ? 'UNKNOWN' : naa50r >= 50 ? 'ABOVE_50' : 'BELOW_50',
        naa200rState:
          naa200r == null ? 'UNKNOWN' : naa200r >= 50 ? 'ABOVE_50' : 'BELOW_50',
      },
    };
  }

  private async getLeaderFlags(): Promise<LeaderFlags> {
    const flags: LeaderFlags = {
      leadersAdvancing: false,
      leadersBasing: false,
      leadersFailing: false,
      leadersExtended: false,
      leadersRotating: false,
      leaderScore: 50,
    };

    const latest = await this.prisma.stockStage.findFirst({
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    if (!latest) return flags;

    const rows = await this.prisma.stockStage.findMany({
      where: { date: latest.date, category: { in: ['HOT', 'FORMER_HOT'] } },
      select: { stage: true, category: true },
    });
    if (rows.length === 0) return flags;

    const hot = rows.filter((r) => r.category === 'HOT');
    const advancing = hot.filter((r) => r.stage === 'STAGE_2').length;
    const basing = hot.filter((r) => r.stage === 'STAGE_1').length;
    const failing = rows.filter((r) => r.stage === 'STAGE_4').length;
    const total = rows.length;

    flags.leadersAdvancing = advancing / total >= 0.4;
    flags.leadersBasing = basing / total >= 0.3;
    flags.leadersFailing = failing / total >= 0.3;
    flags.leadersRotating = !flags.leadersAdvancing && advancing > 0 && basing > 0;
    flags.leaderScore = Math.round((advancing / total) * 100);
    return flags;
  }

  private async buildEqualWeightStructure(
    ticker: string,
    capStructure: StructureSummary,
    breadthStructure: StructureSummary,
  ): Promise<{
    pairs: Array<{
      cap: string;
      equal: string;
      capStructure: StructureSummary;
      equalStructure: StructureSummary;
      naadStructure: StructureSummary;
      divergence: DivergenceState;
    }>;
    primaryDivergence: DivergenceState;
  }> {
    const candidatePairs =
      EQUAL_WEIGHT_PAIRS.filter((pair) => pair.cap === ticker || pair.equal === ticker);
    if (candidatePairs.length === 0) {
      return { pairs: [], primaryDivergence: 'UNKNOWN' };
    }

    const pairs = [];
    for (const pair of candidatePairs) {
      const [capBars, equalBars] = await Promise.all([
        ticker === pair.cap
          ? Promise.resolve([])
          : this.prisma.indexDaily.findMany({
              where: { index: { ticker: pair.cap } },
              orderBy: { date: 'desc' },
              take: 220,
            }),
        this.prisma.indexDaily.findMany({
          where: { index: { ticker: pair.equal } },
          orderBy: { date: 'desc' },
          take: 220,
        }),
      ]);
      const pairCapStructure =
        ticker === pair.cap
          ? capStructure
          : capBars.length > 0
            ? analyzeBarStructure([...capBars].reverse())
            : emptyStructure(null, 'missing_cap_weight_series');
      const equalStructure =
        equalBars.length > 0
          ? analyzeBarStructure([...equalBars].reverse())
          : emptyStructure(null, 'missing_equal_weight_series');
      const divergence = classifyStructureDivergence({
        cap: pairCapStructure,
        equal: equalStructure,
        breadth: breadthStructure,
      });
      pairs.push({
        cap: pair.cap,
        equal: pair.equal,
        capStructure: pairCapStructure,
        equalStructure,
        naadStructure: breadthStructure,
        divergence,
      });
    }

    return {
      pairs,
      primaryDivergence: pairs[0]?.divergence ?? 'UNKNOWN',
    };
  }

  private buildBreadthStructure(
    ticker: string,
    capStructure: StructureSummary | null,
    breadth: BreadthContext,
    equalWeightDivergence: DivergenceState,
  ): Prisma.InputJsonValue {
    return this.toInputJson({
      ticker,
      ...breadth.structure,
      indexStructure: capStructure,
      indexNaadDivergence: capStructure
        ? classifyStructureDivergence({
            cap: capStructure,
            breadth: breadth.structure.naad,
          })
        : 'UNKNOWN',
      equalWeightDivergence,
      interpretation: this.describeBreadthStructure(breadth, equalWeightDivergence),
    });
  }

  private describeBreadthStructure(
    breadth: BreadthContext,
    equalWeightDivergence: DivergenceState,
  ): string {
    const nahl =
      breadth.structure.nahlState === 'POSITIVE'
        ? 'new highs lead new lows'
        : breadth.structure.nahlState === 'NEGATIVE'
          ? 'new lows lead new highs'
          : 'new highs/lows are neutral or unavailable';
    return `${nahl}; NAAD ${breadth.structure.naad.trend.toLowerCase()}; equal-weight divergence ${equalWeightDivergence.toLowerCase()}`;
  }

  private async getSetupPerformance(): Promise<Prisma.InputJsonValue> {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - SETUP_PERFORMANCE_WINDOW_DAYS);
    windowStart.setHours(0, 0, 0, 0);

    const rows = await this.prisma.setupOutcome.findMany({
      where: { effectiveDate: { gte: windowStart } },
      select: {
        source: true,
        family: true,
        setupType: true,
        direction: true,
        effectiveDate: true,
        maxR: true,
        finalR: true,
        metadata: true,
      },
    });

    return this.toInputJson(
      buildSetupPerformanceSummary(
        rows.map((row) => ({
          source: row.source,
          family: row.family,
          setupType: row.setupType,
          direction: row.direction,
          effectiveDate: row.effectiveDate,
          maxR: row.maxR,
          finalR: row.finalR,
          metadata: row.metadata,
        })),
      ),
    );
  }

  private persist(
    date: Date,
    scopeType: MarketScopeType,
    scopeKey: string,
    trend: TrendFlags,
    breadth: BreadthFlags,
    leaders: LeaderFlags,
    trendDetailJson: TrendDetailJson,
    breadthStructureJson: Prisma.InputJsonValue,
    equalWeightStructureJson: Prisma.InputJsonValue,
    setupPerformanceJson: Prisma.InputJsonValue,
  ): Promise<MarketConditionSnapshot> {
    const character = this.deriveCharacter(trend, breadth, leaders);
    const favorable = this.deriveFavorable(trend, breadth, leaders, character);
    const scores = this.deriveScores(trend, breadth, leaders);
    const exposure = this.deriveExposure(scores, character);

    const data = {
      longTermTrendingUp: trend.longTermTrendingUp,
      longTermTrendingDown: trend.longTermTrendingDown,
      longTermRanging: trend.longTermRanging,
      longTermRangeHigh:
        trend.longTermRangeHigh != null
          ? new Prisma.Decimal(trend.longTermRangeHigh)
          : null,
      longTermRangeLow:
        trend.longTermRangeLow != null
          ? new Prisma.Decimal(trend.longTermRangeLow)
          : null,
      midTermTrendingUp: trend.midTermTrendingUp,
      midTermTrendingDown: trend.midTermTrendingDown,
      midTermRanging: trend.midTermRanging,
      midTermExtended: trend.midTermExtended,
      midTermPullback: trend.midTermPullback,
      shortTermTrendingUp: trend.shortTermTrendingUp,
      shortTermTrendingDown: trend.shortTermTrendingDown,
      shortTermRanging: trend.shortTermRanging,
      shortTermExtended: trend.shortTermExtended,
      shortTermOversold: trend.shortTermOversold,
      breadthConfirming: breadth.breadthConfirming,
      breadthDiverging: breadth.breadthDiverging,
      breadthImproving: breadth.breadthImproving,
      breadthDeteriorating: breadth.breadthDeteriorating,
      leadersAdvancing: leaders.leadersAdvancing,
      leadersBasing: leaders.leadersBasing,
      leadersFailing: leaders.leadersFailing,
      leadersExtended: leaders.leadersExtended,
      leadersRotating: leaders.leadersRotating,
      ...character,
      ...favorable,
      ...exposure,
      trendScore: new Prisma.Decimal(trend.trendScore),
      breadthScore: new Prisma.Decimal(breadth.breadthScore),
      leaderScore: new Prisma.Decimal(leaders.leaderScore),
      followThroughScore: new Prisma.Decimal(scores.followThroughScore),
      riskScore: new Prisma.Decimal(scores.riskScore),
      confidenceScore: new Prisma.Decimal(scores.confidenceScore),
      trendDetailJson: this.toInputJson(trendDetailJson),
      breadthStructureJson,
      equalWeightStructureJson,
      setupPerformanceJson,
      summary: this.buildSummary(scopeType, scopeKey, trend, favorable),
    };

    return this.prisma.marketConditionSnapshot.upsert({
      where: { date_scopeType_scopeKey: { date, scopeType, scopeKey } },
      create: { date, scopeType, scopeKey, ...data },
      update: data,
    });
  }

  private deriveCharacter(
    trend: TrendFlags,
    breadth: BreadthFlags,
    leaders: LeaderFlags,
  ) {
    const easyMoney =
      trend.longTermTrendingUp &&
      breadth.breadthImproving &&
      leaders.leadersAdvancing;
    const distribution =
      breadth.breadthDeteriorating && leaders.leadersFailing;
    const earlyRecovery =
      !trend.longTermTrendingDown &&
      trend.shortTermTrendingUp &&
      breadth.breadthImproving &&
      !easyMoney;
    const quickRotation = leaders.leadersRotating && !easyMoney;
    const hardPenny =
      trend.longTermRanging && !breadth.breadthConfirming && !easyMoney;
    return { easyMoney, quickRotation, hardPenny, distribution, earlyRecovery };
  }

  private deriveFavorable(
    trend: TrendFlags,
    breadth: BreadthFlags,
    leaders: LeaderFlags,
    character: ReturnType<MarketConditionService['deriveCharacter']>,
  ) {
    const breakoutFavorable =
      trend.longTermTrendingUp && breadth.breadthConfirming;
    const pullbackFavorable =
      trend.longTermTrendingUp && trend.midTermPullback;
    const reversalFavorable =
      trend.shortTermOversold && !trend.longTermTrendingDown;
    const shortFavorable = trend.longTermTrendingDown && leaders.leadersFailing;
    const holdLongerFavorable = character.easyMoney;
    const scalpOnly = character.quickRotation || character.hardPenny;
    const stayOut = character.distribution && breadth.breadthDeteriorating;
    return {
      breakoutFavorable,
      pullbackFavorable,
      reversalFavorable,
      shortFavorable,
      holdLongerFavorable,
      scalpOnly,
      stayOut,
    };
  }

  private deriveScores(
    trend: TrendFlags,
    breadth: BreadthFlags,
    leaders: LeaderFlags,
  ) {
    const followThroughScore = Math.round(
      (breadth.breadthScore + leaders.leaderScore) / 2,
    );
    const confidenceScore = Math.round(
      trend.trendScore * 0.4 +
        breadth.breadthScore * 0.3 +
        leaders.leaderScore * 0.3,
    );
    const riskScore = Math.max(0, 100 - confidenceScore);
    return { followThroughScore, riskScore, confidenceScore };
  }

  private deriveExposure(
    scores: ReturnType<MarketConditionService['deriveScores']>,
    character: ReturnType<MarketConditionService['deriveCharacter']>,
  ) {
    const c = scores.confidenceScore;
    const aggressiveExposure = c >= 75 && character.easyMoney;
    const marginAllowed = c >= 85 && character.easyMoney;
    const normalExposure = c >= 55 && !aggressiveExposure;
    const waterTest = c >= 40 && c < 55;
    return { waterTest, normalExposure, aggressiveExposure, marginAllowed };
  }

  private buildSummary(
    scopeType: MarketScopeType,
    scopeKey: string,
    trend: TrendFlags,
    favorable: ReturnType<MarketConditionService['deriveFavorable']>,
  ): string {
    const longTerm = trend.longTermTrendingUp
      ? 'up'
      : trend.longTermTrendingDown
        ? 'down'
        : 'range';
    const families = Object.entries(favorable)
      .filter(([, v]) => v)
      .map(([k]) => k.replace('Favorable', '').replace('Only', ''));
    return `${scopeType}:${scopeKey} long-term ${longTerm}; favorable: ${
      families.length ? families.join(', ') : 'none'
    }`;
  }

  private toInputJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}

function buildTrendDetail(trend: TrendFlags): TrendDetailJson {
  return {
    longTerm: {
      state: trend.longTermTrendingUp
        ? 'UP'
        : trend.longTermTrendingDown
          ? 'DOWN'
          : 'RANGE',
      scoreContribution: trend.longTermTrendingUp ? 20 : trend.longTermTrendingDown ? -20 : 0,
      rangeHigh: trend.longTermRangeHigh,
      rangeLow: trend.longTermRangeLow,
    },
    midTerm: {
      state: trend.midTermTrendingUp ? 'UP' : trend.midTermTrendingDown ? 'DOWN' : 'RANGE',
      scoreContribution: trend.midTermTrendingUp ? 15 : trend.midTermTrendingDown ? -15 : 0,
      extended: trend.midTermExtended,
      pullback: trend.midTermPullback,
    },
    shortTerm: {
      state: trend.shortTermTrendingUp
        ? 'UP'
        : trend.shortTermTrendingDown
          ? 'DOWN'
          : 'RANGE',
      scoreContribution: trend.shortTermTrendingUp ? 10 : trend.shortTermTrendingDown ? -10 : 0,
      extended: trend.shortTermExtended,
      oversold: trend.shortTermOversold,
    },
    score: trend.trendScore,
  };
}
