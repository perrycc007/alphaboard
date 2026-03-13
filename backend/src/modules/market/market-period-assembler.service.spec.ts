import { Prisma, SetupFamily, SetupOutcomeSource } from '@prisma/client';
import { MarketPeriodAssemblerService } from './market-period-assembler.service';

describe('MarketPeriodAssemblerService', () => {
  const service = new MarketPeriodAssemblerService();
  const scorecard = {
    REVERSAL: {
      count: 2,
      winRate: 50,
      avgFinalR: 0.2,
      source: 'MIXED' as const,
      liveCount: 1,
      simulatedCount: 1,
    },
    TREND_LONG: {
      count: 3,
      winRate: 67,
      avgFinalR: 0.4,
      source: 'LIVE' as const,
      liveCount: 3,
      simulatedCount: 0,
    },
    TREND_SHORT: {
      count: 1,
      winRate: 0,
      avgFinalR: -0.8,
      source: 'SIMULATED' as const,
      liveCount: 0,
      simulatedCount: 1,
    },
  };

  it('assembles regime + month + year period views from daily regime points', () => {
    const points = [
      {
        date: new Date('2026-01-02'),
        label: 'TREND_UP' as const,
        liveSampleCount: 5,
        simulatedSampleCount: 2,
        scorecard,
        proxyStates: [],
      },
      {
        date: new Date('2026-01-03'),
        label: 'TREND_UP' as const,
        liveSampleCount: 4,
        simulatedSampleCount: 1,
        scorecard,
        proxyStates: [],
      },
      {
        date: new Date('2026-01-04'),
        label: 'RANGE' as const,
        liveSampleCount: 3,
        simulatedSampleCount: 2,
        scorecard,
        proxyStates: [],
      },
    ];

    const periods = service.assemblePeriodViews(points);
    const regime = periods.filter((period) => period.granularity === 'REGIME');
    const month = periods.find(
      (period) => period.granularity === 'MONTH' && period.periodKey === '2026-01',
    );
    const year = periods.find(
      (period) => period.granularity === 'YEAR' && period.periodKey === '2026',
    );

    expect(regime).toHaveLength(2);
    expect(month).toBeDefined();
    expect(month?.sourcePeriodCount).toBe(2);
    expect(year).toBeDefined();
  });

  it('prefers live-only family scoring when live sample thresholds are met', () => {
    const date = new Date('2026-01-10');
    const rows = Array.from({ length: 12 }).map(() => ({
      family: SetupFamily.REVERSAL,
      source: SetupOutcomeSource.LIVE,
      isWin: true,
      finalR: new Prisma.Decimal(1),
      effectiveDate: date,
    }));
    rows.push({
      family: SetupFamily.REVERSAL,
      source: SetupOutcomeSource.SIMULATED,
      isWin: false,
      finalR: new Prisma.Decimal(-1),
      effectiveDate: date,
    });

    const metricsByDate = service.buildRollingFamilyMetricsByDate(
      ['2026-01-10'],
      rows,
      60,
    );
    const reversal = metricsByDate.get('2026-01-10')?.REVERSAL;

    expect(reversal).toBeDefined();
    expect(reversal?.source).toBe('LIVE');
    expect(reversal?.count).toBe(12);
  });
});
