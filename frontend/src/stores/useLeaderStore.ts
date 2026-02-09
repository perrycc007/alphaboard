import { create } from 'zustand'
import type { ApiLeader } from '@/types'
import { fetchLeaders, type LeaderFilters } from '@/lib/api/stocks'

interface LeaderStore {
  leaders: ApiLeader[]
  loading: boolean
  error: string | null
  filters: LeaderFilters

  fetchLeaders: (filters?: LeaderFilters) => Promise<void>
  setFilters: (filters: Partial<LeaderFilters>) => void
}

export const useLeaderStore = create<LeaderStore>((set, get) => ({
  leaders: [],
  loading: false,
  error: null,
  filters: {},

  fetchLeaders: async (filters?: LeaderFilters) => {
    if (get().loading) return
    const activeFilters = filters ?? get().filters
    set({ loading: true, error: null, filters: activeFilters })

    try {
      const leaders = await fetchLeaders(activeFilters)
      set({ leaders, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  setFilters: (partial) => {
    set((s) => ({ filters: { ...s.filters, ...partial } }))
  },
}))
