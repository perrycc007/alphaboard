import { api } from '@/lib/api-client'
import type { ApiStockDaily } from '@/types'

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

export type SetupScanAuditStatus =
  | 'INPUT_FILTERED'
  | 'CANDIDATE'
  | 'INSUFFICIENT_DATA'
  | 'NO_SETUP'
  | 'DETECTED'
  | 'DEDUPED'
  | 'SUPPRESSED'
  | 'ERROR'

export type SetupScanFocusStatus = 'NOT_EVALUATED' | 'INCLUDED' | 'EXCLUDED'

export interface SetupScanAuditRun {
  id: string
  scanRunId: string | null
  status: string
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  stockCount: number
  inputCount: number
  candidateCount: number
  detectedCount: number
  focusIncludedCount: number
  error: string | null
  notes: string | null
}

export interface SetupAuditDetectedSetup {
  setupId?: string
  type: string
  direction: string
  timeframe: string
  state?: string
  pivotPrice?: number | null
  stopPrice?: number | null
  targetPrice?: number | null
  riskReward?: number | null
  evidence?: string[]
  waitingFor?: string | null
  detectedAt?: string
  detectorSource?: string
  outcome?: string
  reason?: string
}

export interface SetupScanAuditItem {
  id: string
  auditRunId: string
  stockId: string
  ticker: string
  name: string | null
  sector: string | null
  industry: string | null
  stage: string | null
  category: string | null
  latestClose: string | number | null
  avgVolume: string | number | null
  scanStatus: SetupScanAuditStatus
  focusStatus: SetupScanFocusStatus
  reasonCodesJson: unknown
  reasonText: string | null
  setupTypesText: string | null
  detectedSetupsJson: unknown
  modelReviewIdsJson: unknown
  focusReason: string | null
  setupBias: string | null
  priorityScore: string | number | null
  identifiedSetupJson: unknown
  error: string | null
  scannedAt: string | null
  dailyBars: ApiStockDaily[]
}

export interface SetupScanAuditSummary {
  run: SetupScanAuditRun
  scanStatusCounts: Partial<Record<SetupScanAuditStatus, number>>
  focusStatusCounts: Partial<Record<SetupScanFocusStatus, number>>
}

export interface SetupScanAuditFilters {
  page?: number
  limit?: number
  scanStatus?: string
  focusStatus?: string
  setupType?: string
  ticker?: string
  q?: string
}

export interface ModelReviewAudit {
  id: string
  scanRunId: string | null
  reviewType: string
  provider: string
  model: string
  inputTokens: number | null
  outputTokens: number | null
  costEstimate: string | number | null
  targetType: string | null
  targetId: string | null
  prompt: string | null
  payloadJson: unknown
  resultJson: unknown
  createdAt: string
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
  expectedBeneficiariesJson?: unknown
  expectedLosersJson?: unknown
  technicalVerificationJson?: {
    checkedAt: string
    verdict: 'ALIGNED' | 'MIXED' | 'NOT_ALIGNED' | 'NO_SETUP_EVIDENCE'
    themeCondition:
      | 'SETUP_LONG'
      | 'SETUP_SHORT'
      | 'HEALTHY_STAGE_2'
      | 'MIXED'
      | 'WEAK'
      | 'NO_EVIDENCE'
    summary: string
    counts: {
      checked: number
      aligned: number
      mismatched: number
      missingSetup: number
      withSetup?: number
      longSetups?: number
      shortSetups?: number
    }
    setupSide?: 'LONG' | 'SHORT' | null
    stageHealth?: {
      stage2Share: number
      constructiveShare: number
      weakShare: number
      stageCounts: Record<string, number>
      categoryCounts: Record<string, number>
    }
    affectedStocks: Array<{
      ticker: string
      name: string
      role: 'BENEFICIARY' | 'LOSER'
      stage?: string | null
      category?: string | null
      stockStatus?: string
      setupDirection: 'LONG' | 'SHORT' | null
      setupType: string | null
      setupState: string | null
      aligned: boolean
      reason: string
    }>
  } | null
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

export type SupplyChainLayer =
  | 'INPUT'
  | 'EQUIPMENT'
  | 'COMPONENT'
  | 'INFRASTRUCTURE'
  | 'PLATFORM'
  | 'APPLICATION'
  | 'DISTRIBUTION'
  | 'END_MARKET'
  | 'FINANCING'

export interface RelationshipEvidenceSource {
  key?: string
  title?: string
  url?: string
}

export interface RelationshipEvidence {
  sourceKeys: string[]
  sources: RelationshipEvidenceSource[]
  raw: unknown
}

export interface RelationshipTheme {
  id: string
  name: string
  description: string | null
}

export interface RelationshipGroup {
  id: string
  themeId: string
  themeName: string
  name: string
  layer: SupplyChainLayer | null
  evidence: RelationshipEvidence
}

export interface RelationshipStock {
  id: string
  ticker: string
  name: string
  sector: string | null
  industry: string | null
  groupIds: string[]
  role: string | null
  evidence: RelationshipEvidence
}

export interface RelationshipEdge {
  id: string
  sourceGroupId: string
  targetGroupId: string
  relationshipType: string
  macroSensitivity: string | null
  eventCategory: string | null
  strengthScore: string | null
  lagDaysEstimate: number | null
  notes: string | null
  evidence: RelationshipEvidence
}

export interface RelationshipCatalyst {
  id: string
  title: string
  themeId: string | null
  groupId: string | null
  status: string
  confidenceScore: string | null
  beneficiaries: unknown
  losers: unknown
  evidence: RelationshipEvidence
}

export interface RelationshipGraph {
  themes: RelationshipTheme[]
  groups: RelationshipGroup[]
  stocks: RelationshipStock[]
  edges: RelationshipEdge[]
  catalysts: RelationshipCatalyst[]
}

export interface RelationshipGraphFilters {
  theme?: string
  group?: string
  layer?: SupplyChainLayer
  eventCategory?: string
  relationshipType?: string
  q?: string
}

// ── Scan runs / full scan ──

export type AlmanacTradeLabel = 'VALID' | 'UNCLEAR' | 'FALSE_POSITIVE' | 'REFERENCE_ONLY'
export type AlmanacSetupPhase =
  | 'APPROACHING'
  | 'TOUCHED'
  | 'TRIGGERED'
  | 'FAILED'
  | 'NEGATIVE'
  | 'REFERENCE'

export interface AlmanacSource {
  id: string
  pdfFileName: string
  title: string | null
  year: number | null
  quarter: number | null
  pageCount: number
  embeddedImageCount: number
  pdfPath: string
  fileSizeBytes: string | number | null
  importedAt: string
}

export interface AlmanacReport {
  id: string
  reportDate: string
  title: string | null
  pageStart: number
  pageEnd: number
  marketContext: string | null
  tickersJson: unknown
  setupTagsJson: unknown
  catalystTagsJson: unknown
  mindsetTagsJson: unknown
  source: AlmanacSource
  _count?: { charts: number; tradeCases: number; doctrines: number }
}

export interface AlmanacChart {
  id: string
  pageNumber: number
  imageNumber: number
  imagePath: string | null
  chartType: string | null
  width: number | null
  height: number | null
  inferredTicker: string | null
  inferredSetupTags: unknown
  nearbyTextSnippet: string | null
  sourceConfidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface AlmanacTradeCase {
  id: string
  ticker: string
  setupTag: string
  direction: 'LONG' | 'SHORT' | null
  phase: AlmanacSetupPhase
  keyLevelsJson: unknown
  catalystTagsJson: unknown
  mindsetTagsJson: unknown
  timeframeStart: string | null
  timeframeEnd: string | null
  sourcePage: number
  sourceExcerpt: string | null
  sourceConfidence: 'HIGH' | 'MEDIUM' | 'LOW'
  label: AlmanacTradeLabel
  reviewNotes: string | null
  source: AlmanacSource
  report: AlmanacReport | null
  chart: AlmanacChart | null
}

export interface AlmanacDoctrine {
  id: string
  title: string
  summary: string
  setupTagsJson: unknown
  mindsetTagsJson: unknown
  catalystTagsJson: unknown
  sourcePage: number | null
  sourceExcerpt: string | null
  sourceConfidence: 'HIGH' | 'MEDIUM' | 'LOW'
  source: AlmanacSource | null
  report: AlmanacReport | null
}

export interface AlmanacExplorerResponse {
  summary: {
    sourceCount: number
    reportCount: number
    chartCount: number
    tradeCaseCount: number
    doctrineCount: number
  }
  sources: AlmanacSource[]
  reports: AlmanacReport[]
  doctrines: AlmanacDoctrine[]
  tradeCases: AlmanacTradeCase[]
  facets: {
    setupTags: Array<{ value: string; count: number }>
    tickers: Array<{ value: string; count: number }>
    setupTaxonomy: string[]
    catalystTags: string[]
    mindsetTags: string[]
  }
  page: number
  limit: number
  total: number
}

export interface AlmanacFilters {
  q?: string
  ticker?: string
  setupTag?: string
  catalystTag?: string
  mindsetTag?: string
  year?: number
  quarter?: number
  label?: AlmanacTradeLabel
  page?: number
  limit?: number
}

export const triggerFullScan = () =>
  api.post<{ message: string }>('/research/full-scan', {})

export const fetchScanRuns = () => api.get<ScanRun[]>('/research/scan-runs')

export const fetchSetupAuditRuns = (limit = 50) =>
  api.get<SetupScanAuditRun[]>(`/research/setup-audit/runs?limit=${limit}`)

export const fetchSetupAuditSummary = (runId: string) =>
  api.get<SetupScanAuditSummary>(`/research/setup-audit/runs/${runId}/summary`)

export const buildSetupAuditItemsQuery = (filters: SetupScanAuditFilters) => {
  const params = new URLSearchParams()
  if (filters.page != null) params.set('page', String(filters.page))
  if (filters.limit != null) params.set('limit', String(filters.limit))
  if (filters.scanStatus) params.set('scanStatus', filters.scanStatus)
  if (filters.focusStatus) params.set('focusStatus', filters.focusStatus)
  if (filters.setupType) params.set('setupType', filters.setupType)
  if (filters.ticker) params.set('ticker', filters.ticker)
  if (filters.q) params.set('q', filters.q)
  return params.toString()
}

export const fetchSetupAuditItems = (runId: string, filters: SetupScanAuditFilters) => {
  const query = buildSetupAuditItemsQuery(filters)
  return api.get<{
    items: SetupScanAuditItem[]
    total: number
    page: number
    limit: number
  }>(`/research/setup-audit/runs/${runId}/items${query ? `?${query}` : ''}`)
}

export const fetchSetupAuditModelReviews = (itemId: string) =>
  api.get<ModelReviewAudit[]>(`/research/setup-audit/items/${itemId}/model-reviews`)

// ── Report ──

export const buildAlmanacQuery = (filters: AlmanacFilters) => {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.ticker) params.set('ticker', filters.ticker)
  if (filters.setupTag) params.set('setupTag', filters.setupTag)
  if (filters.catalystTag) params.set('catalystTag', filters.catalystTag)
  if (filters.mindsetTag) params.set('mindsetTag', filters.mindsetTag)
  if (filters.year != null) params.set('year', String(filters.year))
  if (filters.quarter != null) params.set('quarter', String(filters.quarter))
  if (filters.label) params.set('label', filters.label)
  if (filters.page != null) params.set('page', String(filters.page))
  if (filters.limit != null) params.set('limit', String(filters.limit))
  return params.toString()
}

export const fetchAlmanacExplorer = (filters: AlmanacFilters = {}) => {
  const query = buildAlmanacQuery(filters)
  return api.get<AlmanacExplorerResponse>(`/research/almanac${query ? `?${query}` : ''}`)
}

export const importAlmanacLibrary = (body: {
  extractImages?: boolean
  sourceFile?: string
  maxTradeCasesPerReport?: number
}) => api.post<{ message: string }>('/research/almanac/import', body)

export const reviewAlmanacTradeCase = (
  id: string,
  body: {
    label?: AlmanacTradeLabel
    reviewNotes?: string | null
    phase?: AlmanacSetupPhase
    direction?: 'LONG' | 'SHORT' | null
  },
) => api.post<AlmanacTradeCase>(`/research/almanac/trade-cases/${id}/review`, body)

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

export const verifyCatalyst = (id: string) =>
  api.post<Catalyst>(`/research/catalysts/${id}/verify`, {})

export const buildRelationshipGraphQuery = (filters: RelationshipGraphFilters = {}) => {
  const params = new URLSearchParams()
  if (filters.theme) params.set('theme', filters.theme)
  if (filters.group) params.set('group', filters.group)
  if (filters.layer) params.set('layer', filters.layer)
  if (filters.eventCategory) params.set('eventCategory', filters.eventCategory)
  if (filters.relationshipType) params.set('relationshipType', filters.relationshipType)
  if (filters.q) params.set('q', filters.q)
  return params.toString()
}

export const fetchRelationshipGraph = (filters: RelationshipGraphFilters = {}) => {
  const query = buildRelationshipGraphQuery(filters)
  return api.get<RelationshipGraph>(`/research/relationship-graph${query ? `?${query}` : ''}`)
}
