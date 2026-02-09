import { api } from '@/lib/api-client'
import type { ApiStock, ApiStockDaily, ApiStageHistory, ApiLeader } from '@/types'

/** Stock with latest stage */
export interface ApiStockWithStage extends ApiStock {
  stages: ApiStageHistory[]
}

export function fetchStock(ticker: string): Promise<ApiStockWithStage> {
  return api.get<ApiStockWithStage>(`/stocks/${ticker}`)
}

export function fetchStockDaily(ticker: string, limit = 252): Promise<ApiStockDaily[]> {
  return api.get<ApiStockDaily[]>(`/stocks/${ticker}/daily?limit=${limit}`)
}

export function fetchStockStageHistory(ticker: string): Promise<ApiStageHistory[]> {
  return api.get<ApiStageHistory[]>(`/stocks/${ticker}/stage-history`)
}

export interface ScreenFilters {
  stage?: string
  category?: string
  minRsRank?: number
  maxRsRank?: number
}

export function fetchScreenedStocks(filters: ScreenFilters): Promise<ApiStock[]> {
  const params = new URLSearchParams()
  if (filters.stage) params.set('stage', filters.stage)
  if (filters.category) params.set('category', filters.category)
  if (filters.minRsRank != null) params.set('minRsRank', String(filters.minRsRank))
  if (filters.maxRsRank != null) params.set('maxRsRank', String(filters.maxRsRank))

  return api.get<ApiStock[]>(`/stocks/screen?${params.toString()}`)
}

export interface LeaderFilters {
  minGain?: number
  theme?: string
  days?: number
}

export function fetchLeaders(filters?: LeaderFilters): Promise<ApiLeader[]> {
  const params = new URLSearchParams()
  if (filters?.minGain != null) params.set('minGain', String(filters.minGain))
  if (filters?.theme) params.set('theme', filters.theme)
  if (filters?.days != null) params.set('days', String(filters.days))

  const qs = params.toString()
  return api.get<ApiLeader[]>(`/stocks/leaders${qs ? `?${qs}` : ''}`)
}
