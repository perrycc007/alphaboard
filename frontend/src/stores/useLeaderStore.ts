import { create } from 'zustand'
import type { ApiLeader } from '@/types'
import { fetchLeaders, type LeaderFilters } from '@/lib/api/stocks'

interface LeaderStore {
  leaders: ApiLeader[]
  total: number
  page: number
  limit: number
  loading: boolean
  error: string | null
  filters: LeaderFilters

  fetchLeaders: (filters?: LeaderFilters) => Promise<void>
  setFilters: (filters: Partial<LeaderFilters>) => void
  setPage: (page: number) => void
  reset: () => void
}

export const useLeaderStore = create<LeaderStore>((set, get) => ({
  leaders: [],
  total: 0,
  page: 1,
  limit: 25,
  loading: false,
  error: null,
  filters: {},

  fetchLeaders: async (filters?: LeaderFilters) => {
    if (get().loading) return
    const activeFilters = filters ?? get().filters
    const page = activeFilters.page ?? get().page
    const limit = activeFilters.limit ?? get().limit
    set({ loading: true, error: null, filters: activeFilters })

    try {
      const result = await fetchLeaders({ ...activeFilters, page, limit })
      set({ leaders: result.items, total: result.total, page: result.page, limit: result.limit, loading: false })
    } catch (err) {
      set({
        error: (err as Error).message,
        loading: false,
        leaders: [],
        total: 0,
      })
    }
  },

  setFilters: (partial) => {
    set((s) => ({ filters: { ...s.filters, ...partial } }))
  },

  setPage: (page: number) => {
    const state = get()
    state.fetchLeaders({ ...state.filters, page })
  },

  reset: () => {
    set({ leaders: [], total: 0, page: 1, loading: false, error: null, filters: {} })
  },
}))
