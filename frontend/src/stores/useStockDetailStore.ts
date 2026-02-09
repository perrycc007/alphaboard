import { create } from 'zustand'
import type { ApiStockDaily, ApiBarEvidence, ApiStageHistory } from '@/types'
import type { ApiStockWithStage } from '@/lib/api/stocks'
import { fetchStock, fetchStockDaily, fetchStockStageHistory } from '@/lib/api/stocks'
import { fetchIndexDaily } from '@/lib/api/market'
import { fetchStockEvidence } from '@/lib/api/setups'

interface StockDetailStore {
  ticker: string | null
  stock: ApiStockWithStage | null
  dailyBars: ApiStockDaily[]
  spyBars: ApiStockDaily[]
  evidence: ApiBarEvidence[]
  stageHistory: ApiStageHistory[]
  loading: boolean
  error: string | null

  /** Fetches all stock detail data in parallel (Promise.all) */
  fetchStockDetail: (ticker: string) => Promise<void>
  clear: () => void
}

const INITIAL_STATE = {
  ticker: null,
  stock: null,
  dailyBars: [],
  spyBars: [],
  evidence: [],
  stageHistory: [],
  loading: false,
  error: null,
}

export const useStockDetailStore = create<StockDetailStore>((set, get) => ({
  ...INITIAL_STATE,

  fetchStockDetail: async (ticker: string) => {
    // Skip if already loading the same ticker
    if (get().loading && get().ticker === ticker) return

    set({ ticker, loading: true, error: null })

    try {
      // Fetch all data in parallel -- avoids waterfall (async-parallel rule)
      // SPY is an index entity, not a stock -- fetch from index endpoint
      const [stock, dailyBars, spyIndexBars, evidence, stageHistory] = await Promise.all([
        fetchStock(ticker),
        fetchStockDaily(ticker, 250),
        fetchIndexDaily('SPY', '250'),
        fetchStockEvidence(ticker),
        fetchStockStageHistory(ticker),
      ])

      // Map index bars to ApiStockDaily shape for the chart
      const spyBars: ApiStockDaily[] = spyIndexBars.map((b) => ({
        id: b.id,
        stockId: b.indexId,
        date: b.date,
        open: Number(b.open),
        high: Number(b.high),
        low: Number(b.low),
        close: Number(b.close),
        volume: Number(b.volume),
        sma20: null,
        sma50: null,
        sma150: null,
        sma200: null,
        ema6: null,
        ema20: null,
        rsRank: null,
        atr14: null,
      }))

      // Only update if the ticker hasn't changed while fetching
      if (get().ticker === ticker) {
        set({ stock, dailyBars, spyBars, evidence, stageHistory, loading: false })
      }
    } catch (err) {
      if (get().ticker === ticker) {
        set({ error: (err as Error).message, loading: false })
      }
    }
  },

  clear: () => set(INITIAL_STATE),
}))
