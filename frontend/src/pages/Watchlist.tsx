import { Eye, Plus, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { useSlidePanelStore } from '@/stores/useSlidePanelStore'

const TABS = ['Watchlist', 'Suggested Trades', 'Active Positions'] as const

const MOCK_WATCHLIST = [
  { ticker: 'NVDA', price: 142.5, change: 2.3, stage: 2 as const, alertsOn: true },
  { ticker: 'AVGO', price: 238.1, change: -0.8, stage: 2 as const, alertsOn: true },
  { ticker: 'META', price: 612.0, change: 1.1, stage: 2 as const, alertsOn: false },
  { ticker: 'PANW', price: 198.4, change: 0.5, stage: 2 as const, alertsOn: true },
  { ticker: 'CRWD', price: 385.2, change: -1.2, stage: 3 as const, alertsOn: false },
  { ticker: 'PLTR', price: 78.3, change: 3.5, stage: 2 as const, alertsOn: true },
]

export default function WatchlistPage() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Watchlist')
  const openPanel = useSlidePanelStore((s) => s.openPanel)

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Eye className="h-5 w-5 text-accent sm:h-6 sm:w-6" />
          <h1 className="font-heading text-xl font-bold tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
            Watchlist
          </h1>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover focus-ring cursor-pointer sm:gap-2 sm:px-4 sm:py-2 sm:text-sm">
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Add Stock
        </button>
      </div>

      {/* Intraday signal banner */}
      <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-muted px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning sm:h-4 sm:w-4" />
        <span className="text-xs text-warning sm:text-sm">
          <strong>NVDA</strong> forming intraday base near pivot &middot;{' '}
          <strong>PLTR</strong> 6/20 almost cross
        </span>
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {MOCK_WATCHLIST.map((stock) => (
          <button
            key={stock.ticker}
            onClick={() => openPanel(stock.ticker)}
            className="group rounded-xl border border-border-default bg-bg-surface p-3 text-left transition-colors hover:border-border-accent/30 cursor-pointer sm:p-4"
          >
            <div className="mb-2 flex items-center justify-between sm:mb-3">
              <div className="flex items-center gap-2">
                <span className="font-heading text-xs font-bold text-text-primary sm:text-sm">
                  {stock.ticker}
                </span>
                {stock.alertsOn && (
                  <span className="h-1.5 w-1.5 rounded-full bg-bullish sm:h-2 sm:w-2" title="Alerts on" />
                )}
              </div>
              <span
                className={`font-mono text-[10px] sm:text-xs ${
                  stock.change >= 0 ? 'text-bullish' : 'text-bearish'
                }`}
              >
                {stock.change >= 0 ? '+' : ''}
                {stock.change.toFixed(1)}%
              </span>
            </div>
            {/* Mini chart placeholder */}
            <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-border-muted sm:h-20 lg:h-24">
              <span className="text-[10px] text-text-muted sm:text-xs">Chart</span>
            </div>
            <div className="mt-2 flex items-center justify-between sm:mt-3">
              <span className="font-mono text-xs text-text-secondary sm:text-sm">
                ${stock.price.toFixed(1)}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium sm:text-xs ${
                  stock.stage === 2
                    ? 'bg-stage-2/10 text-stage-2'
                    : stock.stage === 3
                      ? 'bg-stage-3/10 text-stage-3'
                      : 'bg-stage-1/10 text-stage-1'
                }`}
              >
                S{stock.stage}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border-default">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`cursor-pointer px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
              activeTab === tab
                ? 'border-b-2 border-accent text-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content placeholder */}
      <div className="rounded-xl border border-border-default bg-bg-surface p-4 sm:p-6">
        <div className="flex h-32 items-center justify-center sm:h-48">
          <span className="text-xs text-text-muted sm:text-sm">{activeTab} content will render here</span>
        </div>
      </div>
    </div>
  )
}
