import {
  LeaderPeriodActivity,
  MarketPeriodGranularity,
  MarketRegimeLabel,
  MarketTrendLabel,
  SetupType,
  SetupFamily,
  StageEnum,
} from '@prisma/client';
import {
  buildCalendarBuckets,
  classifyMarketRegime,
  deriveLeaderPeriodActivity,
  extractLeaderRunsFromSeries,
} from './market-regime.helpers';

describe('extractLeaderRunsFromSeries', () => {
  it('qualifies only 100%+ stage 2 runs', () => {
    const runs = extractLeaderRunsFromSeries(
      [
        { date: new Date('2024-01-01'), stage: StageEnum.STAGE_1 },
        { date: new Date('2024-01-02'), stage: StageEnum.STAGE_2 },
        { date: new Date('2024-01-03'), stage: StageEnum.STAGE_2 },
        { date: new Date('2024-01-04'), stage: StageEnum.STAGE_3 },
      ],
      [
        { date: new Date('2024-01-02'), close: 10, high: 11 },
        { date: new Date('2024-01-03'), close: 15, high: 20.5 },
      ],
    );

    expect(runs).toHaveLength(1);
    expect(runs[0].peakGainPct).toBeGreaterThanOrEqual(100);
    expect(runs[0].isQualified).toBe(true);
  });
});

describe('classifyMarketRegime', () => {
  it('marks ranging when reversal setups are clearly working best', () => {
    const label = classifyMarketRegime(
      [
        { ticker: 'SPY', trend: MarketTrendLabel.RANGE },
        { ticker: 'QQQ', trend: MarketTrendLabel.TRANSITION },
        { ticker: 'IWM', trend: MarketTrendLabel.RANGE },
      ],
      {
        [SetupFamily.REVERSAL]: { winRate: 70, avgFinalR: 1.5 },
        [SetupFamily.TREND_LONG]: { winRate: 40, avgFinalR: 0.2 },
        [SetupFamily.TREND_SHORT]: { winRate: 35, avgFinalR: 0.1 },
      },
    );

    expect(label).toBe(MarketRegimeLabel.RANGE);
  });
});

describe('buildCalendarBuckets', () => {
  it('creates bounded monthly buckets', () => {
    const buckets = buildCalendarBuckets(
      new Date('2024-01-15T00:00:00.000Z'),
      new Date('2024-03-03T00:00:00.000Z'),
      MarketPeriodGranularity.MONTH,
    );

    expect(buckets).toHaveLength(3);
    expect(buckets[0].key).toBe('2024-01');
    expect(buckets[0].startDate.toISOString()).toBe('2024-01-15T00:00:00.000Z');
    expect(buckets[0].endDate.toISOString()).toBe('2024-01-31T00:00:00.000Z');
    expect(buckets[2].endDate.toISOString()).toBe('2024-03-03T00:00:00.000Z');
  });
});

describe('deriveLeaderPeriodActivity', () => {
  it('marks a stage 2 breakout leader as advancing', () => {
    const result = deriveLeaderPeriodActivity({
      stageAtPeriodEnd: StageEnum.STAGE_2,
      primarySetupType: SetupType.BREAKOUT_PIVOT,
      shortingEnabled: false,
      periodReturnPct: 12,
      setupCount: 1,
    });

    expect(result.activity).toBe(LeaderPeriodActivity.ADVANCING);
  });

  it('marks a qualified stage 4 failure as declining', () => {
    const result = deriveLeaderPeriodActivity({
      stageAtPeriodEnd: StageEnum.STAGE_4,
      primarySetupType: SetupType.FAIL_BASE,
      shortingEnabled: true,
      periodReturnPct: -18,
      setupCount: 1,
    });

    expect(result.activity).toBe(LeaderPeriodActivity.DECLINING);
  });

  it('marks no-setup periods as quiet', () => {
    const result = deriveLeaderPeriodActivity({
      stageAtPeriodEnd: StageEnum.STAGE_1,
      primarySetupType: null,
      shortingEnabled: false,
      periodReturnPct: 1,
      setupCount: 0,
    });

    expect(result.activity).toBe(LeaderPeriodActivity.QUIET);
  });
});
