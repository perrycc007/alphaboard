import { create } from 'zustand'
import type { ApiMarketOverview, ApiBreadthSnapshot } from '@/types'
import { fetchMarketOverview, fetchBreadthSeries } from '@/lib/api/market'

interface MarketStore {
  overview: ApiMarketOverview | null
  breadthSeries: ApiBreadthSnapshot[]
  loading: boolean
  breadthLoading: boolean
  error: string | null

  fetchOverview: () => Promise<void>
  fetchBreadthSeries: (range?: string) => Promise<void>
}

export const useMarketStore = create<MarketStore>((set, get) => ({
  overview: null,
  breadthSeries: [],
  loading: false,
  breadthLoading: false,
  error: null,

  fetchOverview: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const overview = await fetchMarketOverview()
      set({ overview, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  fetchBreadthSeries: async (range?: string) => {
    if (get().breadthLoading) return
    set({ breadthLoading: true })
    try {
      const series = await fetchBreadthSeries(range)
      set({ breadthSeries: series, breadthLoading: false })
    } catch (err) {
      set({ error: (err as Error).message, breadthLoading: false })
    }
  },
}))
