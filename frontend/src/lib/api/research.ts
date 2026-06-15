import { api } from '@/lib/api-client'

// ── Types (subset of backend shapes used by the UI) ──

export interface ScanRun {
  id: string
  type: string
  status: string
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  stockCount: number | null
  focusListCount: number | null
  modelCostEstimate: string | null
  notes: string | null
  error: string | null
}

export interface FocusListItem {
  id: string
  reason: string
  setupBias: string
  priorityScore: string | null
  focusToday: boolean
  focusTodayReason: string | null
  status: string
  expectedSetupTypesJson: unknown
  keyLevelsJson: unknown
  identifiedSetupJson: unknown
  stock: { ticker: string; name: string }
  theme?: { name: string } | null
  group?: { name: string } | null
}

export interface FocusList {
  id: string
  name: string
  type: string
  createdAt: string
  expiresAt: string | null
  items: FocusListItem[]
}

export interface MarketConditionSnapshot {
  id: string
  date: string
  scopeType: string
  scopeKey: string
  longTermTrendingUp: boolean
  longTermTrendingDown: boolean
  longTermRanging: boolean
  midTermPullback: boolean
  shortTermOversold: boolean
  breakoutFavorable: boolean
  pullbackFavorable: boolean
  reversalFavorable: boolean
  shortFavorable: boolean
  stayOut: boolean
  trendScore: string | null
  breadthScore: string | null
  leaderScore: string | null
  confidenceScore: string | null
  trendDetailJson: unknown
  breadthStructureJson: unknown
  equalWeightStructureJson: unknown
  setupPerformanceJson: unknown
  summary: string | null
}

export interface Catalyst {
  id: string
  title: string
  hypothesis: string
  status: string
  confidenceScore: string | null
  createdAt: string
  theme?: { name: string } | null
}

export interface StrategyReport {
  date: string
  marketCondition: {
    index: MarketConditionSnapshot | null
    universe: MarketConditionSnapshot | null
  }
  focusListId: string | null
  focusListSize: number
  topCandidates: Array<{
    ticker: string
    reason: string
    bias: string
    priorityScore: number
    setupTypes: string[]
  }>
  catalysts: Catalyst[]
  summary: string
}

export interface DailyUpdateResult {
  scanRunId: string
  reviewed: number
  focusToday: number
  refreshed: number
}

// ── Scan runs / full scan ──

export const triggerFullScan = () =>
  api.post<{ message: string }>('/research/full-scan', {})

export const fetchScanRuns = () => api.get<ScanRun[]>('/research/scan-runs')

// ── Report ──

export const fetchReport = () => api.get<StrategyReport>('/research/report')

export const buildFocusList = (maxItems?: number) =>
  api.post<FocusList>('/research/focus-list/build', { maxItems })

// ── Focus list ──

export const fetchCurrentFocusList = () =>
  api.get<FocusList | null>('/research/focus-list/current')

export const runDailyUpdate = () =>
  api.post<DailyUpdateResult>('/research/daily-update', {})

// ── Market condition ──

export const fetchMarketCondition = () =>
  api.get<MarketConditionSnapshot[]>('/research/market-condition')

export const rebuildMarketCondition = () =>
  api.post<{ written: number }>('/research/market-condition/rebuild', {})

// ── Catalysts ──

export const fetchCatalysts = (status?: string) =>
  api.get<Catalyst[]>(`/research/catalysts${status ? `?status=${status}` : ''}`)

export const createCatalyst = (body: {
  title: string
  hypothesis: string
  confidenceScore?: number
}) => api.post<Catalyst>('/research/catalysts', body)

export const updateCatalystStatus = (id: string, status: string) =>
  api.post<Catalyst>(`/research/catalysts/${id}/status`, { status })
