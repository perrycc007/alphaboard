import { api } from '@/lib/api-client'
import type { ApiMarketOverview, ApiBreadthSnapshot, ApiIndexDaily } from '@/types'

export function fetchMarketOverview(): Promise<ApiMarketOverview> {
  return api.get<ApiMarketOverview>('/market/overview')
}

export function fetchBreadthSeries(range?: string): Promise<ApiBreadthSnapshot[]> {
  const qs = range ? `?range=${range}` : ''
  return api.get<ApiBreadthSnapshot[]>(`/market/breadth${qs}`)
}

export function fetchIndexDaily(ticker: string, range?: string): Promise<ApiIndexDaily[]> {
  const qs = range ? `?range=${range}` : ''
  return api.get<ApiIndexDaily[]>(`/market/indices/${ticker}/daily${qs}`)
}
