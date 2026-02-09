import { create } from 'zustand'
import type { ApiTheme, ApiThemeDetail } from '@/types'
import { fetchThemes, fetchThemeDetail } from '@/lib/api/themes'

interface ThemeStore {
  themes: ApiTheme[]
  themeDetails: Record<string, ApiThemeDetail>
  loading: boolean
  detailLoading: Record<string, boolean>
  error: string | null

  fetchThemes: () => Promise<void>
  fetchThemeDetail: (id: string) => Promise<void>
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  themes: [],
  themeDetails: {},
  loading: false,
  detailLoading: {},
  error: null,

  fetchThemes: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const themes = await fetchThemes()
      set({ themes, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  fetchThemeDetail: async (id: string) => {
    // Skip if already loaded or currently loading
    if (get().themeDetails[id] || get().detailLoading[id]) return

    set((s) => ({ detailLoading: { ...s.detailLoading, [id]: true } }))
    try {
      const detail = await fetchThemeDetail(id)
      set((s) => ({
        themeDetails: { ...s.themeDetails, [id]: detail },
        detailLoading: { ...s.detailLoading, [id]: false },
      }))
    } catch (err) {
      set((s) => ({
        error: (err as Error).message,
        detailLoading: { ...s.detailLoading, [id]: false },
      }))
    }
  },
}))
