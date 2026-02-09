import { create } from 'zustand'
import type { ApiSetup } from '@/types'
import { fetchActiveSetups } from '@/lib/api/setups'

interface SetupStore {
  dailySetups: ApiSetup[]
  loading: boolean
  error: string | null

  fetchDailySetups: () => Promise<void>
  getSetupsForTicker: (ticker: string) => ApiSetup[]
}

export const useSetupStore = create<SetupStore>((set, get) => ({
  dailySetups: [],
  loading: false,
  error: null,

  fetchDailySetups: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const setups = await fetchActiveSetups({ timeframe: 'DAILY' })
      set({ dailySetups: setups, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  getSetupsForTicker: (ticker: string) => {
    return get().dailySetups.filter((s) => s.stock.ticker === ticker)
  },
}))
