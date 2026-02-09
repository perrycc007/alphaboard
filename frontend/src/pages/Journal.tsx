import { BookOpen } from 'lucide-react'
import { useState } from 'react'

const TABS = ['Journal', 'Personal Stats', 'System Stats'] as const

export default function Journal() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Journal')

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <BookOpen className="h-5 w-5 text-accent sm:h-6 sm:w-6" />
        <h1 className="font-heading text-xl font-bold tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
          Journal & Stats
        </h1>
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

      {/* Content */}
      <div className="rounded-xl border border-border-default bg-bg-surface p-4 sm:p-6">
        {activeTab === 'Journal' && (
          <div className="space-y-3 sm:space-y-4">
            <p className="text-xs text-text-secondary sm:text-sm">Completed trades log with entry/exit details.</p>
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border-muted sm:h-64">
              <span className="text-xs text-text-muted sm:text-sm">Trade journal entries will render here</span>
            </div>
          </div>
        )}
        {activeTab === 'Personal Stats' && (
          <div className="space-y-3 sm:space-y-4">
            <p className="text-xs text-text-secondary sm:text-sm">Your trading performance metrics.</p>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {['Win Rate', 'Avg R', 'Profit Factor', 'Total Trades'].map((stat) => (
                <div
                  key={stat}
                  className="rounded-lg border border-border-muted bg-bg-elevated p-3 sm:p-4"
                >
                  <div className="text-[10px] text-text-muted sm:text-xs">{stat}</div>
                  <div className="font-mono text-lg font-bold text-text-primary sm:text-xl lg:text-2xl">--</div>
                </div>
              ))}
            </div>
            <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border-muted sm:h-48">
              <span className="text-xs text-text-muted sm:text-sm">Equity curve chart will render here</span>
            </div>
          </div>
        )}
        {activeTab === 'System Stats' && (
          <div className="space-y-3 sm:space-y-4">
            <p className="text-xs text-text-secondary sm:text-sm">Paper trade performance of all system-suggested setups.</p>
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border-muted sm:h-64">
              <span className="text-xs text-text-muted sm:text-sm">System stats will render here</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
