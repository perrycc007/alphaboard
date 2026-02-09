/* ============================================
   Core domain types for Alphaboard frontend.
   Aligned to backend Prisma schema enums.
   ============================================ */

// ---- Enums (match Prisma) ----

export type StageEnum = 'STAGE_1' | 'STAGE_2' | 'STAGE_3' | 'STAGE_4'

/** Numeric stage for UI display (1-4) */
export type StageNumber = 1 | 2 | 3 | 4

export type SetupType =
  | 'VCP'
  | 'BREAKOUT_PIVOT'
  | 'BREAKOUT_VCB'
  | 'BREAKOUT_WEDGE'
  | 'FAIL_BREAKOUT'
  | 'FAIL_BASE'
  | 'HIGH_TIGHT_FLAG'
  | 'PULLBACK_BUY'
  | 'UNDERCUT_RALLY'
  | 'DOUBLE_TOP'
  | 'MA_TOUCH'
  | 'EMA20_PULLBACK'
  | 'MA_RALLY_FAILURE'
  | 'EMA200_KEY_LEVEL'
  | 'INTRADAY_BASE'
  | 'CROSS_620'
  | 'GAP_UP'
  | 'GAP_DOWN'
  | 'TIRING_DOWN'

export type SetupState = 'BUILDING' | 'READY' | 'TRIGGERED' | 'VIOLATED' | 'EXPIRED'

export type Timeframe = 'DAILY' | 'INTRADAY'

export type Direction = 'LONG' | 'SHORT'

export type StockCategory = 'HOT' | 'FORMER_HOT' | 'COMMODITY' | 'NONE'

export type AlertType =
  | 'PRICE_LEVEL'
  | 'EMA_CROSS_620'
  | 'SETUP_DETECTED'
  | 'GROUP_CROSS'
  | 'STAGE_CHANGE'

export type EvidencePattern =
  | 'DRY_UP'
  | 'LOWER_WICK_ABSORPTION'
  | 'BULLISH_ENGULFING'
  | 'BEARISH_ENGULFING'
  | 'BREAKOUT_BAR'
  | 'BREAKDOWN_BAR'
  | 'INSIDE_BAR'
  | 'OUTSIDE_BAR'
  | 'SHAKEOUT'
  | 'EXHAUSTION'
  | 'RANGE_EXPANSION'
  | 'TIGHTENING'

export type EvidenceBias = 'BULLISH' | 'BEARISH'

export type KeyLevelType =
  | 'SWING_HIGH'
  | 'SWING_LOW'
  | 'BASE_LOW'
  | 'BASE_HIGH'
  | 'PIVOT'
  | 'SUPPORT'
  | 'RESISTANCE'

export type VolumeState = 'EXPANSION' | 'CONTRACTION' | 'NORMAL'

// ---- Helpers ----

const STAGE_MAP: Record<StageEnum, StageNumber> = {
  STAGE_1: 1,
  STAGE_2: 2,
  STAGE_3: 3,
  STAGE_4: 4,
}

const STAGE_REVERSE: Record<StageNumber, StageEnum> = {
  1: 'STAGE_1',
  2: 'STAGE_2',
  3: 'STAGE_3',
  4: 'STAGE_4',
}

export function parseStageToNumber(stage: StageEnum): StageNumber {
  return STAGE_MAP[stage]
}

export function parseNumberToStage(num: StageNumber): StageEnum {
  return STAGE_REVERSE[num]
}

// ---- API Response types (match backend shapes) ----

/** Backend stock model */
export interface ApiStock {
  id: string
  ticker: string
  name: string
  sector: string | null
  industry: string | null
  exchange: string | null
  avgVolume: number | null
  marketCap: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  stages?: ApiStageHistory[]
  dailyBars?: ApiStockDaily[]
}

/** Daily OHLCV bar with moving averages */
export interface ApiStockDaily {
  id: string
  stockId: string
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  sma20: number | null
  sma50: number | null
  sma150: number | null
  sma200: number | null
  ema6: number | null
  ema20: number | null
  rsRank: number | null
  atr14: number | null
}

/** Index daily bar */
export interface ApiIndexDaily {
  id: string
  indexId: string
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** Stage history entry */
export interface ApiStageHistory {
  id: string
  stockId: string
  date: string
  stage: StageEnum
  category: StockCategory
  isTemplate: boolean
  metadata: unknown
}

/** Bar evidence (confirmation/violation signals) */
export interface ApiBarEvidence {
  id: string
  stockId: string
  timeframe: Timeframe
  barDate: string
  pattern: EvidencePattern
  bias: EvidenceBias
  isViolation: boolean
  keyLevelType: KeyLevelType
  keyLevelPrice: number
  volumeState: VolumeState
  setupId: string | null
  createdAt: string
}

/** Active setup */
export interface ApiSetup {
  id: string
  stockId: string
  type: SetupType
  timeframe: Timeframe
  direction: Direction
  state: SetupState
  detectedAt: string
  expiresAt: string | null
  lastStateAt: string
  pivotPrice: number | null
  stopPrice: number | null
  targetPrice: number | null
  riskReward: number | null
  evidence: unknown
  waitingFor: string | null
  metadata: unknown
  dailyBaseId: string | null
  stock: ApiStock
}

/** Setup with evidence */
export interface ApiSetupWithEvidence extends ApiSetup {
  barEvidence: ApiBarEvidence[]
}

// ---- Theme types ----

export interface ApiThemeStats {
  hotCount: number
  formerHotCount: number
  setupCount: number
  bullishPct: number
  bearishPct: number
  stageDistribution: {
    stage1: number
    stage2: number
    stage3: number
    stage4: number
  }
}

export interface ApiTheme {
  id: string
  name: string
  description: string | null
  stats: ApiThemeStats
}

export interface ApiThemeStock {
  id: string
  stockId: string
  groupId: string
  stock: ApiStock
}

export interface ApiThemeGroup {
  id: string
  themeId: string
  name: string
  sortOrder: number
  themeStocks: ApiThemeStock[]
}

export interface ApiThemeDetail {
  id: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  groups: ApiThemeGroup[]
}

// ---- Market types ----

export interface ApiBreadthSnapshot {
  id: string
  date: string
  naad: number | null
  naa50r: number | null
  naa200r: number | null
  nahl: number | null
  avgWeightIdx: number | null
}

export interface ApiMarketIndex {
  ticker: string
  name: string
  latest: ApiIndexDaily | null
}

export interface ApiMarketOverview {
  indices: ApiMarketIndex[]
  breadth: ApiBreadthSnapshot | null
  timestamp: string
}

// ---- Trade types ----

export type TradeIdeaStatus = 'PENDING' | 'CONFIRMED' | 'SKIPPED' | 'EXPIRED'
export type PositionStatus = 'OPEN' | 'CLOSED'
export type Bias = 'BULLISH' | 'BEARISH' | 'BOTH'

export interface ApiExecution {
  id: string
  orderId: string
  price: number
  quantity: number
  fee: number | null
  executedAt: string
  positionId: string | null
}

export interface ApiPosition {
  id: string
  userId: string | null
  ticker: string
  direction: Direction
  quantity: number
  avgEntry: number
  currentStop: number | null
  realizedPnl: number
  unrealizedPnl: number
  status: PositionStatus
  openedAt: string
  closedAt: string | null
  executions: ApiExecution[]
}

export interface ApiTradeIdea {
  id: string
  userId: string | null
  setupId: string | null
  stockId: string
  direction: Direction
  bias: Bias
  entryPrice: number | null
  stopPrice: number
  targetPrice: number | null
  riskPercent: number
  riskReward: number | null
  status: TradeIdeaStatus
  createdAt: string
  notes: string | null
  setup?: ApiSetup | null
}

// ---- Alert ----
export interface ApiAlert {
  id: string
  ticker: string
  type: AlertType
  enabled: boolean
  triggeredAt: string | null
  message: string
}

// ---- Watchlist ----
export interface ApiWatchlist {
  id: string
  name: string
  stockCount: number
  items: ApiWatchlistItem[]
}

export interface ApiWatchlistItem {
  ticker: string
  stock: ApiStock
  alertsEnabled: AlertType[]
  addedAt: string
}

// ---- Notification ----
export interface ApiNotification {
  id: string
  type: AlertType
  ticker: string
  message: string
  read: boolean
  createdAt: string
  data?: Record<string, unknown>
}

// ---- Leader (playbook) ----
export interface ApiLeader {
  ticker: string
  name: string
  peakGain: number
  duration: number
  theme: string | null
  entryDate: string
  peakDate: string
  entryPrice: number
  peakPrice: number
  stage: StageEnum
}

// ---- Derived UI types ----

/** Direction computed from bullishPct/bearishPct thresholds */
export type ThemeDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL'

export function computeThemeDirection(bullishPct: number, bearishPct: number): ThemeDirection {
  if (bullishPct >= 70) return 'BULLISH'
  if (bearishPct >= 70) return 'BEARISH'
  return 'NEUTRAL'
}
