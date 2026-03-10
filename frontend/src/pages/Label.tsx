import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Loader2, ChevronLeft, ChevronRight, BarChart3, Tag } from 'lucide-react'
import {
  fetchManifest,
  fetchLabels,
  saveLabel,
  fetchLabelStats,
  getChartImageUrl,
  sendNextToTelegram,
  type ManifestEntry,
  type LabelEntry,
  type LabelStats,
} from '@/lib/api/labels'
import { cn } from '@/lib/utils'

const RULE_VERSION = 'v1'

const SETUP_COLORS: Record<string, string> = {
  TREND_LONG_20EMA_PULLBACK: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  TREND_LONG_20EMA_LEGACY: 'bg-lime-500/15 text-lime-400 border-lime-500/30',
  BASE_FAILURE_SHORT: 'bg-red-500/15 text-red-400 border-red-500/30',
  TREND_SHORT_20EMA_RALLY: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  BASE_MA_LONG: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  DOUBLE_TOP: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  DOUBLE_BOTTOM: 'bg-green-500/15 text-green-400 border-green-500/30',
}

const ALL_SETUP_TYPES = [
  'TREND_LONG_20EMA_PULLBACK',
  'TREND_LONG_20EMA_LEGACY',
  'BASE_FAILURE_SHORT',
  'TREND_SHORT_20EMA_RALLY',
  'BASE_MA_LONG',
  'DOUBLE_TOP',
  'DOUBLE_BOTTOM',
]

type HumanLabel = LabelEntry['human_label']

export default function LabelPage() {
  const [manifest, setManifest] = useState<ManifestEntry[]>([])
  const [labels, setLabels] = useState<Map<string, LabelEntry>>(new Map())
  const [stats, setStats] = useState<LabelStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [filterType, setFilterType] = useState<string>('all')
  const [showWrongTypeMenu, setShowWrongTypeMenu] = useState(false)
  const [telegramChatId, setTelegramChatId] = useState('')
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    async function load() {
      try {
        const [m, l, s] = await Promise.all([
          fetchManifest(RULE_VERSION),
          fetchLabels(RULE_VERSION),
          fetchLabelStats(RULE_VERSION),
        ])
        setManifest(m)
        setLabels(new Map(l.map((lb) => [lb.chart_id, lb])))
        setStats(s)
      } catch {
        /* manifest may not exist yet */
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const queue = useMemo(() => {
    let items = manifest
    if (filterType !== 'all') {
      items = items.filter((m) => m.setup_type === filterType)
    }
    const unlabeled = items.filter((m) => !labels.has(m.chart_id))
    const labeled = items.filter((m) => labels.has(m.chart_id))
    return [...unlabeled, ...labeled]
  }, [manifest, labels, filterType])

  const current = queue[currentIdx] ?? null
  const currentLabel = current ? labels.get(current.chart_id) : undefined
  const labeledCount = labels.size
  const totalCount = manifest.length

  const handleLabel = useCallback(
    async (humanLabel: HumanLabel, correctType: string | null = null) => {
      if (!current || saving) return
      setSaving(true)
      setShowWrongTypeMenu(false)
      const entry: LabelEntry = {
        chart_id: current.chart_id,
        human_label: humanLabel,
        correct_type: correctType,
        reviewed_at: new Date().toISOString(),
      }
      try {
        await saveLabel(RULE_VERSION, entry)
        setLabels((prev) => {
          const next = new Map(prev)
          next.set(current.chart_id, entry)
          return next
        })
        if (currentIdx < queue.length - 1) {
          setCurrentIdx((i) => i + 1)
        }
      } finally {
        setSaving(false)
      }
    },
    [current, saving, currentIdx, queue.length],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (showWrongTypeMenu) return
      switch (e.key.toLowerCase()) {
        case 'y':
          handleLabel('yes')
          break
        case 'n':
          handleLabel('no')
          break
        case 'w':
          setShowWrongTypeMenu(true)
          break
        case 'u':
          handleLabel('unsure')
          break
        case 'arrowleft':
          setCurrentIdx((i) => Math.max(0, i - 1))
          break
        case 'arrowright':
          setCurrentIdx((i) => Math.min(queue.length - 1, i + 1))
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleLabel, showWrongTypeMenu, queue.length])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted sm:h-8 sm:w-8" />
      </div>
    )
  }

  if (manifest.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 sm:gap-4">
        <Tag className="h-8 w-8 text-text-muted sm:h-10 sm:w-10" />
        <p className="text-sm text-text-muted sm:text-base">
          No chart images found. Run the batch export in <code>setup_detectors.ipynb</code> first.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3 sm:gap-4 sm:p-4 lg:gap-5 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary sm:text-2xl lg:text-3xl">
            Setup Labeling
          </h1>
          <p className="text-xs text-text-muted sm:text-sm">
            {labeledCount} / {totalCount} labeled
            {queue.length !== totalCount && ` (${queue.length} in filter)`}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setCurrentIdx(0) }}
            className="h-8 rounded-lg border border-border-default bg-bg-surface px-2 text-xs text-text-primary sm:h-9 sm:px-3 sm:text-sm lg:h-10"
          >
            <option value="all">All Types</option>
            {ALL_SETUP_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-hover sm:h-2">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${totalCount > 0 ? (labeledCount / totalCount) * 100 : 0}%` }}
        />
      </div>

      {/* Telegram quick send */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-default bg-bg-surface p-2 sm:gap-3 sm:p-3">
        <BarChart3 className="h-4 w-4 text-text-muted sm:h-5 sm:w-5" />
        <span className="text-xs text-text-secondary sm:text-sm">Telegram quick label:</span>
        <input
          value={telegramChatId}
          onChange={(e) => setTelegramChatId(e.target.value)}
          placeholder="chat id"
          className="h-8 w-36 rounded-md border border-border-default bg-bg-default px-2 text-xs text-text-primary sm:h-9 sm:w-44 sm:text-sm"
        />
        <button
          onClick={async () => {
            if (!telegramChatId.trim()) return
            setTelegramStatus('sending...')
            try {
              const res = await sendNextToTelegram(telegramChatId.trim(), RULE_VERSION)
              setTelegramStatus(res.sent ? `sent ${res.chart_id ?? 'next chart'}` : `not sent (${res.reason ?? 'unknown'})`)
            } catch {
              setTelegramStatus('failed to send')
            }
          }}
          className="h-8 rounded-md border border-accent/40 bg-accent/10 px-3 text-xs font-semibold text-accent hover:bg-accent/20 sm:h-9 sm:text-sm"
        >
          Send Next To Telegram
        </button>
        {telegramStatus && <span className="text-[10px] text-text-muted sm:text-xs">{telegramStatus}</span>}
      </div>

      {current ? (
        <div className="flex flex-1 flex-col gap-3 sm:gap-4">
          {/* Chart card */}
          <div className="relative flex-1 overflow-hidden rounded-lg border border-border-default bg-bg-surface">
            {/* Badge + info overlay */}
            <div className="absolute left-3 top-3 z-10 flex items-center gap-2 sm:left-4 sm:top-4">
              <span
                className={cn(
                  'inline-flex items-center rounded border px-2 py-1 text-xs font-semibold sm:text-sm',
                  SETUP_COLORS[current.setup_type] ?? 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30',
                )}
              >
                {current.setup_type.replace(/_/g, ' ')}
              </span>
              <span className="rounded bg-bg-surface/80 px-1.5 py-0.5 text-[10px] text-text-secondary backdrop-blur-sm sm:text-xs">
                {current.ticker} &middot; {current.alert_date}
              </span>
              {currentLabel && (
                <span className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase sm:text-xs',
                  currentLabel.human_label === 'yes' && 'bg-green-500/20 text-green-400',
                  currentLabel.human_label === 'no' && 'bg-red-500/20 text-red-400',
                  currentLabel.human_label === 'wrong_type' && 'bg-amber-500/20 text-amber-400',
                  currentLabel.human_label === 'unsure' && 'bg-neutral-500/20 text-neutral-400',
                )}>
                  {currentLabel.human_label === 'wrong_type'
                    ? `WRONG → ${currentLabel.correct_type}`
                    : currentLabel.human_label}
                </span>
              )}
            </div>

            {/* Navigation */}
            <div className="absolute right-3 top-3 z-10 flex items-center gap-1 sm:right-4 sm:top-4">
              <span className="rounded bg-bg-surface/80 px-1.5 py-0.5 text-[10px] text-text-muted backdrop-blur-sm sm:text-xs">
                {currentIdx + 1} / {queue.length}
              </span>
            </div>

            <img
              ref={imgRef}
              src={getChartImageUrl(RULE_VERSION, current.chart_path)}
              alt={`${current.ticker} ${current.setup_type} ${current.alert_date}`}
              className="h-full w-full object-contain"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <button
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-default bg-bg-surface text-text-secondary transition-colors hover:bg-bg-hover disabled:opacity-30 sm:h-10 sm:w-10 lg:h-11 lg:w-11"
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            <button
              onClick={() => handleLabel('yes')}
              disabled={saving}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-4 text-xs font-semibold text-green-400 transition-colors hover:bg-green-500/20 sm:h-10 sm:px-5 sm:text-sm lg:h-11 lg:px-6"
            >
              Yes <kbd className="ml-1 rounded bg-green-500/20 px-1 text-[10px] sm:text-xs">Y</kbd>
            </button>

            <button
              onClick={() => handleLabel('no')}
              disabled={saving}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20 sm:h-10 sm:px-5 sm:text-sm lg:h-11 lg:px-6"
            >
              No <kbd className="ml-1 rounded bg-red-500/20 px-1 text-[10px] sm:text-xs">N</kbd>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowWrongTypeMenu((v) => !v)}
                disabled={saving}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-500/20 sm:h-10 sm:px-5 sm:text-sm lg:h-11 lg:px-6"
              >
                Wrong Type <kbd className="ml-1 rounded bg-amber-500/20 px-1 text-[10px] sm:text-xs">W</kbd>
              </button>
              {showWrongTypeMenu && (
                <div className="absolute bottom-full left-0 z-20 mb-1 w-56 rounded-lg border border-border-default bg-bg-surface p-1 shadow-lg sm:w-64">
                  {ALL_SETUP_TYPES.filter((t) => t !== current.setup_type).map((t) => (
                    <button
                      key={t}
                      onClick={() => handleLabel('wrong_type', t)}
                      className="w-full rounded px-3 py-1.5 text-left text-xs text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary sm:text-sm"
                    >
                      {t.replace(/_/g, ' ')}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowWrongTypeMenu(false)}
                    className="mt-1 w-full rounded px-3 py-1.5 text-left text-xs text-text-muted hover:bg-bg-hover sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => handleLabel('unsure')}
              disabled={saving}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-neutral-500/30 bg-neutral-500/10 px-4 text-xs font-semibold text-neutral-400 transition-colors hover:bg-neutral-500/20 sm:h-10 sm:px-5 sm:text-sm lg:h-11 lg:px-6"
            >
              Unsure <kbd className="ml-1 rounded bg-neutral-500/20 px-1 text-[10px] sm:text-xs">U</kbd>
            </button>

            <button
              onClick={() => setCurrentIdx((i) => Math.min(queue.length - 1, i + 1))}
              disabled={currentIdx >= queue.length - 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-default bg-bg-surface text-text-secondary transition-colors hover:bg-bg-hover disabled:opacity-30 sm:h-10 sm:w-10 lg:h-11 lg:w-11"
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-text-muted sm:text-base">No charts in current filter.</p>
        </div>
      )}

      {/* Stats footer */}
      {stats && (
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border-default bg-bg-surface p-3 sm:grid-cols-4 sm:gap-3 sm:p-4 lg:grid-cols-7">
          {Object.entries(stats.byType).map(([type, counts]) => (
            <div key={type} className="space-y-0.5">
              <p className="truncate text-[10px] font-medium text-text-muted sm:text-xs">
                {type.replace(/_/g, ' ')}
              </p>
              <div className="flex gap-1.5 text-[10px] sm:text-xs">
                <span className="text-green-400">{counts.yes}Y</span>
                <span className="text-red-400">{counts.no}N</span>
                <span className="text-text-muted">{counts.total}T</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
