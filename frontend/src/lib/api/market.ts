import { api } from '@/lib/api-client'
import type {
  ApiMarketOverview,
  ApiBreadthSnapshot,
  ApiIndexDaily,
  ApiMarketRegimePeriod,
  MarketPeriodGranularity,
} from '@/types'

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

export function fetchMarketRegimes(params?: {
  from?: string
  to?: string
  granularity?: MarketPeriodGranularity
}): Promise<ApiMarketRegimePeriod[]> {
  const search = new URLSearchParams()
  if (params?.from) search.set('from', params.from)
  if (params?.to) search.set('to', params.to)
  if (params?.granularity) search.set('granularity', params.granularity)
  const qs = search.toString()
  return api.get<ApiMarketRegimePeriod[]>(`/market/regimes${qs ? `?${qs}` : ''}`)
}

export function fetchMarketRegimeMarkdown(params?: {
  from?: string
  to?: string
  granularity?: MarketPeriodGranularity
}): Promise<{
  format: 'markdown'
  content: string
}> {
  const search = new URLSearchParams({ format: 'markdown' })
  if (params?.from) search.set('from', params.from)
  if (params?.to) search.set('to', params.to)
  if (params?.granularity) search.set('granularity', params.granularity)
  return api.get<{ format: 'markdown'; content: string }>(`/market/regimes/report?${search.toString()}`)
}
