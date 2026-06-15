import { useCallback, useEffect, useState } from 'react'
import { Target, RefreshCw, Sun, Loader2 } from 'lucide-react'
import {
  fetchCurrentFocusList,
  runDailyUpdate,
  type FocusList as FocusListType,
  type DailyUpdateResult,
} from '@/lib/api/research'

export default function FocusList() {
  const [list, setList] = useState<FocusListType | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [result, setResult] = useState<DailyUpdateResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setList(await fetchCurrentFocusList())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load focus list')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleDailyUpdate = async () => {
    setUpdating(true)
    setError(null)
    try {
      setResult(await runDailyUpdate())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Daily update failed')
    } finally {
      setUpdating(false)
    }
  }

  const items = list?.items ?? []
  const focusToday = items.filter((i) => i.focusToday)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Target className="h-5 w-5 text-accent sm:h-6 sm:w-6" />
          <h1 className="font-heading text-xl font-bold tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
            Focus List
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDailyUpdate}
            disabled={updating}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 cursor-pointer sm:px-4 sm:py-2 sm:text-sm"
          >
            {updating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
            ) : (
              <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            )}
            Daily Update
          </button>
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary cursor-pointer sm:px-4 sm:py-2 sm:text-sm"
          >
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-bearish/30 bg-bearish/10 px-3 py-2 text-xs text-bearish sm:text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-bullish/30 bg-bullish/10 px-3 py-2 text-xs text-bullish sm:text-sm">
          Daily update: reviewed {result.reviewed}, refreshed {result.refreshed}, focus today {result.focusToday}.
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      ) : !list ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-border-default bg-bg-surface">
          <span className="text-xs text-text-muted sm:text-sm">
            No active focus list. Run a full scan or build one from the Research Report.
          </span>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border-default bg-bg-surface px-4 py-3">
            <span className="font-heading text-sm font-semibold text-text-primary sm:text-base">
              {list.name}
            </span>
            <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] text-text-secondary sm:text-xs">
              {list.type}
            </span>
            <span className="text-[10px] text-text-muted sm:text-xs">
              {items.length} names · {focusToday.length} focus today
            </span>
            {list.expiresAt && (
              <span className="text-[10px] text-text-muted sm:text-xs">
                expires {new Date(list.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border-default bg-bg-surface">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="text-text-muted">
                <tr className="border-b border-border-muted">
                  <th className="px-4 py-2 font-medium">Ticker</th>
                  <th className="px-4 py-2 font-medium">Bias</th>
                  <th className="px-4 py-2 font-medium">Setup</th>
                  <th className="px-4 py-2 font-medium">Levels</th>
                  <th className="px-4 py-2 font-medium">Reason</th>
                  <th className="px-4 py-2 font-medium">Priority</th>
                  <th className="px-4 py-2 font-medium">Today</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border-muted/50 align-top">
                    <td className="px-4 py-2">
                      <span className="font-heading font-bold text-text-primary">
                        {item.stock.ticker}
                      </span>
                      <span className="ml-2 hidden text-text-muted sm:inline">
                        {item.stock.name}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <BiasBadge bias={item.setupBias} />
                    </td>
                    <td className="px-4 py-2">
                      <SetupIdentity value={item.identifiedSetupJson} />
                    </td>
                    <td className="px-4 py-2">
                      <SetupLevels value={item.identifiedSetupJson} fallback={item.keyLevelsJson} />
                    </td>
                    <td className="px-4 py-2 text-text-secondary">
                      {item.reason.replace(/_/g, ' ').toLowerCase()}
                    </td>
                    <td className="px-4 py-2 font-mono text-text-secondary">
                      {item.priorityScore != null ? Math.round(Number(item.priorityScore)) : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {item.focusToday ? (
                        <span
                          className="inline-block h-2 w-2 rounded-full bg-bullish"
                          title={item.focusTodayReason ?? 'Focus today'}
                        />
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-text-muted">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

interface IdentifiedSetup {
  type?: string | null
  state?: string | null
  direction?: string | null
  pivot?: number | null
  stop?: number | null
  target?: number | null
  evidence?: string[]
  rationale?: string | null
}

function SetupIdentity({ value }: { value: unknown }) {
  const setup = asSetup(value)
  const type = setup.type ?? 'No setup'
  const state = setup.state ?? 'UNKNOWN'
  return (
    <div className="min-w-40 space-y-1">
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase text-text-secondary">
          {type.replace(/_/g, ' ')}
        </span>
        <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-accent">
          {state.replace(/_/g, ' ')}
        </span>
      </div>
      {setup.evidence && setup.evidence.length > 0 && (
        <div className="max-w-64 text-[10px] leading-4 text-text-muted">
          {setup.evidence.slice(0, 2).join(' | ')}
        </div>
      )}
    </div>
  )
}

function SetupLevels({
  value,
  fallback,
}: {
  value: unknown
  fallback: unknown
}) {
  const setup = asSetup(value)
  const fallbackLevels = asLevelFallback(fallback)
  const pivot = setup.pivot ?? fallbackLevels.pivot
  const stop = setup.stop ?? fallbackLevels.stop
  const target = setup.target ?? fallbackLevels.target
  return (
    <div className="grid min-w-36 grid-cols-3 gap-1 font-mono text-[10px] text-text-secondary">
      <Level label="P" value={pivot} />
      <Level label="S" value={stop} />
      <Level label="T" value={target} />
    </div>
  )
}

function Level({ label, value }: { label: string; value: number | null }) {
  return (
    <span className="rounded border border-border-muted px-1 py-0.5">
      {label} {value != null ? value.toFixed(2) : '-'}
    </span>
  )
}

function BiasBadge({ bias }: { bias: string }) {
  const color =
    bias === 'LONG'
      ? 'bg-bullish/10 text-bullish'
      : bias === 'SHORT'
        ? 'bg-bearish/10 text-bearish'
        : bias === 'BOTH'
          ? 'bg-accent/10 text-accent'
          : 'bg-secondary text-text-muted'
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium sm:text-xs ${color}`}>
      {bias}
    </span>
  )
}

function asSetup(value: unknown): IdentifiedSetup {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as IdentifiedSetup)
    : {}
}

function asLevelFallback(value: unknown): {
  pivot: number | null
  stop: number | null
  target: number | null
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { pivot: null, stop: null, target: null }
  }
  const record = value as Record<string, unknown>
  return {
    pivot: firstNumber(record.pivots),
    stop: firstNumber(record.stops),
    target: firstNumber(record.targets),
  }
}

function firstNumber(value: unknown): number | null {
  if (!Array.isArray(value)) return null
  const found = value.find((item) => typeof item === 'number' && Number.isFinite(item))
  return typeof found === 'number' ? found : null
}
