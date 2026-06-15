import { useCallback, useEffect, useState } from 'react'
import { Newspaper, Plus, Loader2 } from 'lucide-react'
import {
  fetchCatalysts,
  createCatalyst,
  updateCatalystStatus,
  type Catalyst,
} from '@/lib/api/research'

const STATUSES = ['WATCHING', 'CONFIRMED', 'REJECTED', 'STALE'] as const

function statusColor(status: string): string {
  switch (status) {
    case 'CONFIRMED':
      return 'bg-bullish/10 text-bullish'
    case 'REJECTED':
      return 'bg-bearish/10 text-bearish'
    case 'STALE':
      return 'bg-secondary text-text-muted'
    default:
      return 'bg-warning-muted text-warning'
  }
}

export default function Catalysts() {
  const [catalysts, setCatalysts] = useState<Catalyst[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [hypothesis, setHypothesis] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCatalysts(await fetchCatalysts())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load catalysts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async () => {
    if (!title.trim() || !hypothesis.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createCatalyst({ title: title.trim(), hypothesis: hypothesis.trim() })
      setTitle('')
      setHypothesis('')
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  const handleStatus = async (id: string, status: string) => {
    try {
      await updateCatalystStatus(id, status)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Newspaper className="h-5 w-5 text-accent sm:h-6 sm:w-6" />
          <h1 className="font-heading text-xl font-bold tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
            Catalysts
          </h1>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover cursor-pointer sm:px-4 sm:py-2 sm:text-sm"
        >
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          New Catalyst
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-bearish/30 bg-bearish/10 px-3 py-2 text-xs text-bearish sm:text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <div className="space-y-3 rounded-xl border border-border-default bg-bg-surface p-4 sm:p-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Catalyst title"
            className="w-full rounded-lg border border-border-default bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
          <textarea
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            placeholder="Hypothesis: what changes, who benefits, who is hurt..."
            rows={3}
            className="w-full rounded-lg border border-border-default bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary cursor-pointer sm:text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !title.trim() || !hypothesis.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50 cursor-pointer sm:text-sm"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      ) : catalysts.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-border-default bg-bg-surface">
          <span className="text-xs text-text-muted sm:text-sm">
            No catalysts yet. Add one manually or generate from a theme.
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {catalysts.map((cat) => (
            <div
              key={cat.id}
              className="rounded-xl border border-border-default bg-bg-surface p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-heading text-sm font-semibold text-text-primary sm:text-base">
                    {cat.title}
                  </p>
                  {cat.theme?.name && (
                    <p className="text-[10px] text-text-muted sm:text-xs">{cat.theme.name}</p>
                  )}
                </div>
                <span className={`rounded px-2 py-0.5 text-[10px] font-medium sm:text-xs ${statusColor(cat.status)}`}>
                  {cat.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-text-secondary sm:text-sm">{cat.hypothesis}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {STATUSES.filter((s) => s !== cat.status).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatus(cat.id, s)}
                    className="rounded-md border border-border-muted px-2 py-0.5 text-[10px] text-text-secondary transition-colors hover:text-text-primary cursor-pointer sm:text-xs"
                  >
                    {s.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
