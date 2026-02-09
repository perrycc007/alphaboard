import { create } from 'zustand'

interface SlidePanelState {
  open: boolean
  ticker: string | null
  openPanel: (ticker: string) => void
  closePanel: () => void
}

export const useSlidePanelStore = create<SlidePanelState>((set) => ({
  open: false,
  ticker: null,
  openPanel: (ticker) => set({ open: true, ticker }),
  closePanel: () => set({ open: false, ticker: null }),
}))
