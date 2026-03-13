import type {
  ApiMarketProxyState,
  ApiMarketRegimePeriod,
  ApiMarketScoreMetric,
  ApiPeriodLeaderSummary,
  MarketRegimeLabel,
  SetupFamily,
  StageEnum,
} from '@/types'

export type PeriodSort = 'NEWEST' | 'OLDEST' | 'LEADERS' | 'REVERSAL' | 'TREND'
export type LeaderSort = 'PEAK_GAIN' | 'TICKER' | 'STAGE' | 'SHORTABLE'

export type DisplayLeader = ApiPeriodLeaderSummary & {
  appearances: number
  primarySetup: ApiPeriodLeaderSummary['activeSetups'][number] | null
}

export type DisplayPeriod = {
  id: string
  key: string
  label: string
  startDate: string
  endDate: string
  labelRaw: MarketRegimeLabel
  scorecard: Record<SetupFamily, ApiMarketScoreMetric>
  proxyStates: ApiMarketProxyState[]
  leaders: DisplayLeader[]
  liveSampleCount: number
  simulatedSampleCount: number
  periods: ApiMarketRegimePeriod[]
}

export type DisplaySummary = {
  periodCount: number
  rangeStart: string
  rangeEnd: string
  dominantRegime: MarketRegimeLabel
  dominantRegimeCount: number
  uniqueLeaders: number
  shortReadyLeaders: number
  leadingFamily: SetupFamily | null
  liveSamples: number
  simulatedSamples: number
}

export const FAMILY_KEYS: SetupFamily[] = ['REVERSAL', 'TREND_LONG', 'TREND_SHORT']
export const PROXY_ORDER = ['SPY', 'QQQ', 'IWM', 'GLD', 'UUP']

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
})

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const YEAR_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
})

const EMPTY_METRIC: ApiMarketScoreMetric = {
  count: 0,
  winRate: 0,
  avgFinalR: 0,
  source: 'NONE',
  liveCount: 0,
  simulatedCount: 0,
}

export function buildDisplayPeriods(periods: ApiMarketRegimePeriod[]): DisplayPeriod[] {
  return [...periods]
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .map((period) => ({
      id: period.id,
      key: period.periodKey,
      label: formatPeriodLabel(period),
      startDate: period.startDate,
      endDate: period.endDate,
      labelRaw: period.label,
      scorecard: normalizeScorecard(period.scorecard),
      proxyStates: [...period.proxyStates].sort(
        (a, b) => PROXY_ORDER.indexOf(a.ticker) - PROXY_ORDER.indexOf(b.ticker),
      ),
      leaders: aggregateLeaders([period]),
      liveSampleCount: period.liveSampleCount,
      simulatedSampleCount: period.simulatedSampleCount,
      periods: [period],
    }))
}

function formatPeriodLabel(period: ApiMarketRegimePeriod) {
  if (period.granularity === 'YEAR') {
    return period.periodKey
  }

  if (period.granularity === 'MONTH') {
    const [year, month] = period.periodKey.split('-')
    if (year && month) {
      return MONTH_FORMATTER.format(new Date(`${year}-${month}-01T00:00:00.000Z`))
    }
  }

  return formatDateRange(period.startDate, period.endDate)
}

export function formatDateRange(start: string, end: string) {
  const startDate = new Date(start)
  const endDate = new Date(end)

  if (startDate.toDateString() === endDate.toDateString()) {
    return LONG_DATE_FORMATTER.format(startDate)
  }

  if (
    startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
    startDate.getUTCMonth() === endDate.getUTCMonth()
  ) {
    return `${SHORT_DATE_FORMATTER.format(startDate)} - ${endDate.getUTCDate()}, ${YEAR_FORMATTER.format(endDate)}`
  }

  if (startDate.getUTCFullYear() === endDate.getUTCFullYear()) {
    return `${SHORT_DATE_FORMATTER.format(startDate)} - ${LONG_DATE_FORMATTER.format(endDate)}`
  }

  return `${LONG_DATE_FORMATTER.format(startDate)} - ${LONG_DATE_FORMATTER.format(endDate)}`
}

export function formatLongDate(date: string) {
  return LONG_DATE_FORMATTER.format(new Date(date))
}

function normalizeScorecard(
  scorecard: Partial<Record<SetupFamily, ApiMarketScoreMetric>>,
): Record<SetupFamily, ApiMarketScoreMetric> {
  return {
    REVERSAL: scorecard.REVERSAL ?? EMPTY_METRIC,
    TREND_LONG: scorecard.TREND_LONG ?? EMPTY_METRIC,
    TREND_SHORT: scorecard.TREND_SHORT ?? EMPTY_METRIC,
  }
}

export function aggregateScorecards(
  periods: ApiMarketRegimePeriod[],
): Record<SetupFamily, ApiMarketScoreMetric> {
  const next = {} as Record<SetupFamily, ApiMarketScoreMetric>

  for (const family of FAMILY_KEYS) {
    const metrics = periods
      .map((period) => normalizeScorecard(period.scorecard)[family])
      .filter(Boolean)

    const count = metrics.reduce((sum, item) => sum + item.count, 0)
    const liveCount = metrics.reduce((sum, item) => sum + item.liveCount, 0)
    const simulatedCount = metrics.reduce((sum, item) => sum + item.simulatedCount, 0)
    const weightedWin = metrics.reduce((sum, item) => sum + item.winRate * item.count, 0)
    const weightedR = metrics.reduce((sum, item) => sum + item.avgFinalR * item.count, 0)

    next[family] = {
      count,
      winRate: count > 0 ? weightedWin / count : 0,
      avgFinalR: count > 0 ? weightedR / count : 0,
      source: deriveMetricSource(liveCount, simulatedCount),
      liveCount,
      simulatedCount,
    }
  }

  return next
}

function deriveMetricSource(
  liveCount: number,
  simulatedCount: number,
): ApiMarketScoreMetric['source'] {
  if (liveCount > 0 && simulatedCount > 0) return 'MIXED'
  if (liveCount > 0) return 'LIVE'
  if (simulatedCount > 0) return 'SIMULATED'
  return 'NONE'
}

function aggregateLeaders(periods: ApiMarketRegimePeriod[]): DisplayLeader[] {
  const leaderMap = new Map<string, DisplayLeader>()

  for (const period of periods) {
    for (const leader of period.leaderSummary) {
      const primarySetup = leader.activeSetups[0] ?? null
      const existing = leaderMap.get(leader.ticker)

      if (!existing) {
        leaderMap.set(leader.ticker, {
          ...leader,
          activeSetups: uniqueSetups(leader.activeSetups),
          appearances: 1,
          primarySetup,
        })
        continue
      }

      const entryCandidate =
        leader.peakGainPct > existing.peakGainPct ? leader.entryPrice : existing.entryPrice
      const peakCandidate =
        leader.peakGainPct > existing.peakGainPct ? leader.peakPrice : existing.peakPrice

      leaderMap.set(leader.ticker, {
        ...existing,
        name: leader.name || existing.name,
        stage2StartDate:
          new Date(leader.stage2StartDate).getTime() < new Date(existing.stage2StartDate).getTime()
            ? leader.stage2StartDate
            : existing.stage2StartDate,
        stage2EndDate:
          new Date(leader.stage2EndDate).getTime() > new Date(existing.stage2EndDate).getTime()
            ? leader.stage2EndDate
            : existing.stage2EndDate,
        peakGainPct: Math.max(existing.peakGainPct, leader.peakGainPct),
        entryPrice: entryCandidate,
        peakPrice: peakCandidate,
        stageAtPeriodEnd: leader.stageAtPeriodEnd ?? existing.stageAtPeriodEnd,
        activeSetups: uniqueSetups([...existing.activeSetups, ...leader.activeSetups]),
        shortingEnabled: existing.shortingEnabled || leader.shortingEnabled,
        appearances: existing.appearances + 1,
        primarySetup: primarySetup ?? existing.primarySetup,
      })
    }
  }

  return [...leaderMap.values()].sort((a, b) => b.peakGainPct - a.peakGainPct)
}

function uniqueSetups(setups: ApiPeriodLeaderSummary['activeSetups']) {
  const map = new Map<string, ApiPeriodLeaderSummary['activeSetups'][number]>()

  for (const setup of setups) {
    map.set(`${setup.type}:${setup.state}:${setup.direction}`, setup)
  }

  return [...map.values()]
}

export function sortPeriods(a: DisplayPeriod, b: DisplayPeriod, mode: PeriodSort) {
  const aStart = new Date(a.startDate).getTime()
  const bStart = new Date(b.startDate).getTime()

  switch (mode) {
    case 'OLDEST':
      return aStart - bStart
    case 'LEADERS':
      return b.leaders.length - a.leaders.length || bStart - aStart
    case 'REVERSAL':
      return (
        scoreFamily(b.scorecard.REVERSAL) - scoreFamily(a.scorecard.REVERSAL) || bStart - aStart
      )
    case 'TREND':
      return (
        Math.max(
          scoreFamily(b.scorecard.TREND_LONG),
          scoreFamily(b.scorecard.TREND_SHORT),
        ) -
          Math.max(
            scoreFamily(a.scorecard.TREND_LONG),
            scoreFamily(a.scorecard.TREND_SHORT),
          ) || bStart - aStart
      )
    case 'NEWEST':
    default:
      return bStart - aStart
  }
}

export function sortLeaders(a: DisplayLeader, b: DisplayLeader, mode: LeaderSort) {
  switch (mode) {
    case 'TICKER':
      return a.ticker.localeCompare(b.ticker)
    case 'STAGE':
      return stageRank(b.stageAtPeriodEnd) - stageRank(a.stageAtPeriodEnd)
    case 'SHORTABLE':
      return Number(b.shortingEnabled) - Number(a.shortingEnabled) || b.peakGainPct - a.peakGainPct
    case 'PEAK_GAIN':
    default:
      return b.peakGainPct - a.peakGainPct
  }
}

export function getDominantFamily(scorecard: Record<SetupFamily, ApiMarketScoreMetric>) {
  const ranked = FAMILY_KEYS.map((family) => ({
    family,
    score: scoreFamily(scorecard[family]),
  })).sort((a, b) => b.score - a.score)

  return ranked[0]?.score > 0 ? ranked[0].family : null
}

export function scoreFamily(metric: ApiMarketScoreMetric) {
  return metric.avgFinalR * 100 + metric.winRate * 10 + metric.count
}

export function buildSummary(periods: DisplayPeriod[]): DisplaySummary {
  const leaders = new Map<string, DisplayLeader>()
  const regimeCounts = new Map<DisplayPeriod['labelRaw'], number>()

  let liveSamples = 0
  let simulatedSamples = 0

  for (const period of periods) {
    regimeCounts.set(period.labelRaw, (regimeCounts.get(period.labelRaw) ?? 0) + 1)
    liveSamples += period.liveSampleCount
    simulatedSamples += period.simulatedSampleCount

    for (const leader of period.leaders) {
      leaders.set(leader.ticker, leader)
    }
  }

  const dominantRegime =
    [...regimeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'TRANSITION'
  const leadingFamily = periods.length
    ? getDominantFamily(aggregateScorecards(periods.flatMap((period) => period.periods)))
    : null

  const sortedPeriods = [...periods].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  )

  return {
    periodCount: periods.length,
    rangeStart: sortedPeriods[0] ? formatLongDate(sortedPeriods[0].startDate) : 'N/A',
    rangeEnd: sortedPeriods[sortedPeriods.length - 1]
      ? formatLongDate(sortedPeriods[sortedPeriods.length - 1].endDate)
      : 'N/A',
    dominantRegime,
    dominantRegimeCount: regimeCounts.get(dominantRegime) ?? 0,
    uniqueLeaders: leaders.size,
    shortReadyLeaders: [...leaders.values()].filter((leader) => leader.shortingEnabled).length,
    leadingFamily,
    liveSamples,
    simulatedSamples,
  }
}

function stageRank(stage: StageEnum | null) {
  switch (stage) {
    case 'STAGE_4':
      return 4
    case 'STAGE_3':
      return 3
    case 'STAGE_2':
      return 2
    case 'STAGE_1':
      return 1
    default:
      return 0
  }
}
