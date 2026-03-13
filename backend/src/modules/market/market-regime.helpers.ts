import {
  LeaderPeriodActivity,
  MarketPeriodGranularity,
  MarketRegimeLabel,
  MarketTrendLabel,
  SetupFamily,
  SetupType,
  StageEnum,
} from '@prisma/client';

export interface LeaderRunInput {
  date: Date;
  stage: StageEnum;
}

export interface LeaderBarInput {
  date: Date;
  close: number;
  high: number;
}

export interface ExtractedLeaderRun {
  stage2StartDate: Date;
  stage2EndDate: Date;
  entryPrice: number;
  peakPrice: number;
  peakGainPct: number;
  isQualified: boolean;
}

export interface ProxyStateVote {
  ticker: string;
  trend: MarketTrendLabel;
}

export interface RegimeMetric {
  winRate: number;
  avgFinalR: number;
}

export interface CalendarBucket {
  key: string;
  granularity: MarketPeriodGranularity;
  startDate: Date;
  endDate: Date;
}

export type AggregatedPeriodGranularity = 'MONTH' | 'YEAR';

export interface LeaderActivityInput {
  stageAtPeriodEnd: StageEnum | null;
  primarySetupType: SetupType | null;
  shortingEnabled: boolean;
  periodReturnPct: number | null;
  setupCount: number;
}

export function extractLeaderRunsFromSeries(
  stages: LeaderRunInput[],
  bars: LeaderBarInput[],
): ExtractedLeaderRun[] {
  const runs: ExtractedLeaderRun[] = [];
  let runStart: Date | null = null;
  let lastStage2Date: Date | null = null;

  const flushRun = () => {
    if (!runStart || !lastStage2Date) return;
    const runBars = bars.filter(
      (bar) => bar.date.getTime() >= runStart!.getTime() && bar.date.getTime() <= lastStage2Date!.getTime(),
    );
    if (runBars.length === 0) {
      runStart = null;
      lastStage2Date = null;
      return;
    }

    const entryPrice = runBars[0].close;
    const peakPrice = Math.max(...runBars.map((bar) => bar.high));
    const peakGainPct = entryPrice > 0 ? ((peakPrice - entryPrice) / entryPrice) * 100 : 0;
    runs.push({
      stage2StartDate: runStart,
      stage2EndDate: lastStage2Date,
      entryPrice,
      peakPrice,
      peakGainPct,
      isQualified: peakGainPct >= 100,
    });

    runStart = null;
    lastStage2Date = null;
  };

  for (const stage of stages) {
    if (stage.stage === StageEnum.STAGE_2) {
      runStart ??= stage.date;
      lastStage2Date = stage.date;
    } else if (runStart) {
      flushRun();
    }
  }

  if (runStart) {
    flushRun();
  }

  return runs;
}

export function classifyMarketRegime(
  proxyStates: ProxyStateVote[],
  metrics: Record<SetupFamily, RegimeMetric>,
): MarketRegimeLabel {
  const upVotes = proxyStates.filter((state) => state.trend === MarketTrendLabel.UPTREND).length;
  const downVotes = proxyStates.filter((state) => state.trend === MarketTrendLabel.DOWNTREND).length;

  const reversalScore = metrics[SetupFamily.REVERSAL].winRate + metrics[SetupFamily.REVERSAL].avgFinalR * 10;
  const trendLongScore = metrics[SetupFamily.TREND_LONG].winRate + metrics[SetupFamily.TREND_LONG].avgFinalR * 10;
  const trendShortScore = metrics[SetupFamily.TREND_SHORT].winRate + metrics[SetupFamily.TREND_SHORT].avgFinalR * 10;

  if (upVotes >= 2 && trendLongScore >= reversalScore + 10) {
    return MarketRegimeLabel.TREND_UP;
  }
  if (downVotes >= 2 && trendShortScore >= reversalScore + 10) {
    return MarketRegimeLabel.TREND_DOWN;
  }
  if (
    reversalScore >= trendLongScore + 10 &&
    reversalScore >= trendShortScore + 10
  ) {
    return MarketRegimeLabel.RANGE;
  }
  return MarketRegimeLabel.TRANSITION;
}

export function buildCalendarBuckets(
  rangeStart: Date,
  rangeEnd: Date,
  granularity: AggregatedPeriodGranularity,
): CalendarBucket[] {
  const buckets: CalendarBucket[] = [];
  let cursor =
    granularity === MarketPeriodGranularity.MONTH
      ? createUtcDate(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), 1)
      : createUtcDate(rangeStart.getUTCFullYear(), 0, 1);

  while (cursor.getTime() <= rangeEnd.getTime()) {
    const rawEnd =
      granularity === MarketPeriodGranularity.MONTH
        ? createUtcDate(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)
        : createUtcDate(cursor.getUTCFullYear(), 11, 31);
    const bucketStart = cursor.getTime() < rangeStart.getTime() ? stripDate(rangeStart) : cursor;
    const bucketEnd =
      rawEnd.getTime() > rangeEnd.getTime() ? stripDate(rangeEnd) : rawEnd;

    buckets.push({
      key:
        granularity === MarketPeriodGranularity.MONTH
          ? `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`
          : `${cursor.getUTCFullYear()}`,
      granularity,
      startDate: bucketStart,
      endDate: bucketEnd,
    });

    cursor =
      granularity === MarketPeriodGranularity.MONTH
        ? createUtcDate(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)
        : createUtcDate(cursor.getUTCFullYear() + 1, 0, 1);
  }

  return buckets;
}

export function deriveLeaderPeriodActivity(
  input: LeaderActivityInput,
): { activity: LeaderPeriodActivity; note: string } {
  const breakoutTypes = new Set<SetupType>([
    SetupType.VCP,
    SetupType.BREAKOUT_PIVOT,
    SetupType.BREAKOUT_VCB,
    SetupType.BREAKOUT_WEDGE,
    SetupType.HIGH_TIGHT_FLAG,
  ]);
  const pullbackTypes = new Set<SetupType>([
    SetupType.PULLBACK_BUY,
    SetupType.EMA20_PULLBACK,
    SetupType.MA_TOUCH,
  ]);
  const reversalTypes = new Set<SetupType>([
    SetupType.UNDERCUT_RALLY,
    SetupType.DOUBLE_TOP,
  ]);
  const declineTypes = new Set<SetupType>([
    SetupType.FAIL_BREAKOUT,
    SetupType.FAIL_BASE,
    SetupType.MA_RALLY_FAILURE,
    SetupType.GAP_DOWN,
    SetupType.TIRING_DOWN,
  ]);

  if (input.primarySetupType && breakoutTypes.has(input.primarySetupType)) {
    if (input.stageAtPeriodEnd === StageEnum.STAGE_2 && (input.periodReturnPct ?? 0) > 0) {
      return {
        activity: LeaderPeriodActivity.ADVANCING,
        note: 'Stage 2 leader advancing with a bullish daily setup.',
      };
    }
    return {
      activity: LeaderPeriodActivity.SETTING_UP,
      note: 'Bullish daily setup is active inside this period.',
    };
  }

  if (input.primarySetupType && pullbackTypes.has(input.primarySetupType)) {
    return {
      activity: LeaderPeriodActivity.PULLBACK,
      note: 'Leader is pulling back into a continuation buy area.',
    };
  }

  if (input.primarySetupType && reversalTypes.has(input.primarySetupType)) {
    return {
      activity: LeaderPeriodActivity.REVERSAL,
      note: 'Reversal-style daily setup is active in this period.',
    };
  }

  if (
    (input.primarySetupType && declineTypes.has(input.primarySetupType)) ||
    input.stageAtPeriodEnd === StageEnum.STAGE_4
  ) {
    return {
      activity: LeaderPeriodActivity.DECLINING,
      note: input.shortingEnabled
        ? 'Qualified past leader is now weakening and short-eligible.'
        : 'Leader is weakening or trending lower.',
    };
  }

  if (input.stageAtPeriodEnd === StageEnum.STAGE_3) {
    return {
      activity: LeaderPeriodActivity.BASING,
      note: 'Leader is in a Stage 3 base or topping area.',
    };
  }

  if (input.stageAtPeriodEnd === StageEnum.STAGE_2 && (input.periodReturnPct ?? 0) >= 8) {
    return {
      activity: LeaderPeriodActivity.ADVANCING,
      note: 'Stage 2 advance continued through this period.',
    };
  }

  if (input.setupCount > 0) {
    return {
      activity: LeaderPeriodActivity.SETTING_UP,
      note: 'Daily setups were present even if price action stayed mixed.',
    };
  }

  return {
    activity: LeaderPeriodActivity.QUIET,
    note: 'No major daily setup or directional move dominated this period.',
  };
}

export function pickDominantRegimeLabel(labels: MarketRegimeLabel[]): MarketRegimeLabel {
  const counts = new Map<MarketRegimeLabel, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return (
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    MarketRegimeLabel.TRANSITION
  );
}

export function overlapDays(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): number {
  const start = Math.max(stripDate(startA).getTime(), stripDate(startB).getTime());
  const end = Math.min(stripDate(endA).getTime(), stripDate(endB).getTime());
  if (end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function periodSpanDays(startDate: Date, endDate: Date): number {
  return overlapDays(startDate, endDate, startDate, endDate);
}

function createUtcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function stripDate(value: Date): Date {
  return createUtcDate(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}
