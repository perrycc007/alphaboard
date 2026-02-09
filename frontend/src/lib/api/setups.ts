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
