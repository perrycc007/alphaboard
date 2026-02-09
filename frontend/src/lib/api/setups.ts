import { api } from '@/lib/api-client'
import type { ApiSetup, ApiSetupWithEvidence, ApiBarEvidence, SetupType, Direction, Timeframe } from '@/types'

export interface SetupFilters {
  type?: SetupType
  direction?: Direction
  timeframe?: Timeframe
}

export function fetchActiveSetups(filters?: SetupFilters): Promise<ApiSetup[]> {
  const params = new URLSearchParams()
  if (filters?.type) params.set('type', filters.type)
  if (filters?.direction) params.set('direction', filters.direction)
  if (filters?.timeframe) params.set('timeframe', filters.timeframe)

  const qs = params.toString()
  return api.get<ApiSetup[]>(`/setups${qs ? `?${qs}` : ''}`)
}

export function fetchSetupDetail(id: string): Promise<ApiSetupWithEvidence> {
  return api.get<ApiSetupWithEvidence>(`/setups/${id}`)
}

export function fetchStockEvidence(ticker: string, timeframe?: Timeframe): Promise<ApiBarEvidence[]> {
  const params = new URLSearchParams()
  if (timeframe) params.set('timeframe', timeframe)

  const qs = params.toString()
  return api.get<ApiBarEvidence[]>(`/stocks/${ticker}/evidence${qs ? `?${qs}` : ''}`)
}

export interface SimulatedSetup {
  id: string
  type: string
  direction: string
  state: string
  detectedAt: string
  pivotPrice: number | null
  stopPrice: number | null
  targetPrice: number | null
  riskReward: number | null
  evidence: string[]
  metadata: Record<string, unknown>
  stateHistory: Array<{ state: string; date: string }>
  tradeCategory: 'BREAKOUT' | 'REVERSAL' | null
  entryPrice: number | null
  entryDate: string | null
  exitPrice: number | null
  exitDate: string | null
  actualStopPrice: number | null
  riskAmount: number | null
  maxR: number | null
  maxPct: number | null
  finalR: number | null
  finalPct: number | null
  holdingDays: number | null
}

export function fetchSimulatedSetups(
  ticker: string,
  from?: string,
): Promise<SimulatedSetup[]> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  const qs = params.toString()
  return api.get<SimulatedSetup[]>(
    `/setups/simulate/${ticker.toUpperCase()}${qs ? `?${qs}` : ''}`,
    { timeoutMs: 120_000 },
  )
}
