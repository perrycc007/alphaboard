import { create } from 'zustand'
import type { ApiPosition, ApiTradeIdea } from '@/types'
import { fetchPositions, fetchTradeIdeas } from '@/lib/api/trades'

interface TradeStore {
  positions: ApiPosition[]
  ideas: ApiTradeIdea[]
  loading: boolean
  error: string | null

  fetchPositions: () => Promise<void>
  fetchIdeas: () => Promise<void>
}

export const useTradeStore = create<TradeStore>((set, get) => ({
  positions: [],
  ideas: [],
  loading: false,
  error: null,

  fetchPositions: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const positions = await fetchPositions()
      set({ positions, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  fetchIdeas: async () => {
    try {
      const ideas = await fetchTradeIdeas()
      set({ ideas })
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },
}))
