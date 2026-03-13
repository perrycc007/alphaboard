import { describe, expect, it } from 'vitest'
import type { ApiMarketRegimePeriod } from '@/types'
import {
  buildSummary,
  buildDisplayPeriods,
  formatDateRange,
  getDominantFamily,
  sortLeaders,
  type DisplayLeader,
} from './market-regimes.selectors'

const scorecard = {
  REVERSAL: {
    count: 10,
    winRate: 40,
    avgFinalR: -0.2,
    source: 'MIXED' as const,
    liveCount: 5,
    simulatedCount: 5,
  },
  TREND_LONG: {
    count: 14,
    winRate: 65,
    avgFinalR: 0.6,
    source: 'LIVE' as const,
    liveCount: 14,
    simulatedCount: 0,
  },
  TREND_SHORT: {
    count: 6,
    winRate: 50,
    avgFinalR: 0.15,
    source: 'SIMULATED' as const,
    liveCount: 0,
    simulatedCount: 6,
  },
}

describe('market-regimes selectors', () => {
  it('buildDisplayPeriods uses backend granularity/periodKey labels', () => {
    const periods: ApiMarketRegimePeriod[] = [
      {
        id: 'p-1',
        granularity: 'MONTH',
        periodKey: '2026-01',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-31T00:00:00.000Z',
        label: 'TREND_UP',
        liveSampleCount: 12,
        simulatedSampleCount: 3,
        sourcePeriodCount: 4,
        scorecard,
        proxyStates: [],
        leaderSummary: [],
        markdown: null,
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
      },
    ]

    const display = buildDisplayPeriods(periods)

    expect(display).toHaveLength(1)
    expect(display[0].key).toBe('2026-01')
    expect(display[0].label).toBe('Jan 2026')
  })

  it('sortLeaders shortable mode ranks short-enabled leaders first', () => {
    const base: Omit<DisplayLeader, 'ticker' | 'shortingEnabled' | 'peakGainPct'> = {
      name: 'Leader',
      stage2StartDate: '2024-01-01',
      stage2EndDate: '2024-06-01',
      entryPrice: 10,
      peakPrice: 25,
      activity: 'ADVANCING',
      activityNote: '',
      identifiedSetupLabel: null,
      stageAtPeriodStart: 'STAGE_2',
      stageAtPeriodEnd: 'STAGE_3',
      activeSetups: [],
      appearances: 1,
      primarySetup: null,
    }

    const leaders: DisplayLeader[] = [
      { ...base, ticker: 'BBB', shortingEnabled: false, peakGainPct: 200 },
      { ...base, ticker: 'AAA', shortingEnabled: true, peakGainPct: 120 },
    ]

    const sorted = [...leaders].sort((a, b) => sortLeaders(a, b, 'SHORTABLE'))

    expect(sorted[0].ticker).toBe('AAA')
  })

  it('getDominantFamily favors strongest weighted family score', () => {
    expect(getDominantFamily(scorecard)).toBe('TREND_LONG')
  })

  it('buildSummary returns stable period and leader totals', () => {
    const periods: ApiMarketRegimePeriod[] = [
      {
        id: 'p-1',
        granularity: 'MONTH',
        periodKey: '2026-01',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-31T00:00:00.000Z',
        label: 'TREND_UP',
        liveSampleCount: 12,
        simulatedSampleCount: 3,
        sourcePeriodCount: 4,
        scorecard,
        proxyStates: [],
        leaderSummary: [
          {
            ticker: 'AAA',
            name: 'Alpha A',
            stage2StartDate: '2024-01-01',
            stage2EndDate: '2024-06-01',
            peakGainPct: 120,
            entryPrice: 10,
            peakPrice: 22,
            activity: 'ADVANCING',
            activityNote: '',
            identifiedSetupLabel: 'Breakout Ready / LONG',
            stageAtPeriodStart: 'STAGE_2',
            stageAtPeriodEnd: 'STAGE_3',
            activeSetups: [{ type: 'BREAKOUT_PIVOT', state: 'READY', direction: 'LONG' }],
            shortingEnabled: true,
          },
        ],
        markdown: null,
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
      },
      {
        id: 'p-2',
        granularity: 'MONTH',
        periodKey: '2026-02',
        startDate: '2026-02-01T00:00:00.000Z',
        endDate: '2026-02-28T00:00:00.000Z',
        label: 'RANGE',
        liveSampleCount: 5,
        simulatedSampleCount: 7,
        sourcePeriodCount: 2,
        scorecard,
        proxyStates: [],
        leaderSummary: [
          {
            ticker: 'BBB',
            name: 'Beta B',
            stage2StartDate: '2024-02-01',
            stage2EndDate: '2024-08-01',
            peakGainPct: 110,
            entryPrice: 20,
            peakPrice: 42,
            activity: 'BASING',
            activityNote: '',
            identifiedSetupLabel: null,
            stageAtPeriodStart: 'STAGE_3',
            stageAtPeriodEnd: 'STAGE_4',
            activeSetups: [{ type: 'DOUBLE_TOP', state: 'READY', direction: 'SHORT' }],
            shortingEnabled: true,
          },
        ],
        markdown: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    ]

    const display = buildDisplayPeriods(periods)
    const summary = buildSummary(display)

    expect(summary.periodCount).toBe(2)
    expect(summary.uniqueLeaders).toBe(2)
    expect(summary.shortReadyLeaders).toBe(2)
    expect(summary.liveSamples).toBe(17)
    expect(summary.simulatedSamples).toBe(10)
  })

  it('formatDateRange renders compact single-month spans', () => {
    expect(
      formatDateRange('2026-02-01T00:00:00.000Z', '2026-02-10T00:00:00.000Z'),
    ).toBe('Feb 1 - 10, 2026')
  })
})
