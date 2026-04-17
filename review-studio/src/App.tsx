import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clipboard,
  Filter,
  FolderSync,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react'

import {
  assetUrl,
  createPrompt,
  fetchItems,
  fetchJob,
  fetchLogic,
  fetchRuns,
  saveFeedback,
  saveLogic,
  saveNote,
  startRerun,
  type JobStatus,
  type LogicSnapshot,
  type ReviewItem,
  type RunSummary,
} from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

type PromptAction = 'explain' | 'revise' | 'split' | 'refresh_summary'

const PROMPT_ACTIONS: Array<{ key: PromptAction; label: string; description: string; icon: typeof Bot }> = [
  {
    key: 'explain',
    label: 'Explain logic',
    description: 'Translate rules into trader language.',
    icon: Bot,
  },
  {
    key: 'revise',
    label: 'Revise false positives',
    description: 'Ask Cursor for the smallest logic improvement.',
    icon: Sparkles,
  },
  {
    key: 'split',
    label: 'Split setup',
    description: 'Break one mixed detector into two clear setups.',
    icon: FolderSync,
  },
  {
    key: 'refresh_summary',
    label: 'Refresh summary',
    description: 'Rewrite the layman explanation after code changes.',
    icon: RefreshCw,
  },
]

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatWhen(value?: string | null): string {
  if (!value) return 'Not yet'
  return new Date(value).toLocaleString()
}

function reviewTone(outcome?: string | null) {
  if (outcome === 'valid') return 'text-bullish bg-bullish/10 border-bullish/25'
  if (outcome === 'false_positive') return 'text-bearish bg-bearish/10 border-bearish/25'
  return 'text-text-secondary bg-secondary border-border'
}

function textareaClassName(rows = 'min-h-[96px]') {
  return `${rows} w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30`
}

export default function App() {
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [selectedRunId, setSelectedRunId] = useState('')
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)
  const [tickerFilter, setTickerFilter] = useState('')
  const [setupFilter, setSetupFilter] = useState('ALL')
  const [reviewedFilter, setReviewedFilter] = useState('all')
  const [outcomeFilter, setOutcomeFilter] = useState('all')
  const [selectedChartId, setSelectedChartId] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [notes, setNotes] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [savingReview, setSavingReview] = useState(false)
  const [savingLogicState, setSavingLogicState] = useState(false)
  const [logicCache, setLogicCache] = useState<Record<string, LogicSnapshot>>({})
  const [logicLoading, setLogicLoading] = useState(false)
  const [logicForm, setLogicForm] = useState({
    summary_plain: '',
    trigger_conditions: '',
    common_false_positives: '',
  })
  const [activeJob, setActiveJob] = useState<JobStatus | null>(null)

  const deferredTicker = useDeferredValue(tickerFilter)

  const currentRun = useMemo(
    () => runs.find((run) => run.run_id === selectedRunId) ?? null,
    [runs, selectedRunId],
  )

  const currentItem = useMemo(
    () => items.find((item) => item.chart_id === selectedChartId) ?? items[0] ?? null,
    [items, selectedChartId],
  )

  const currentLogic = currentItem ? logicCache[currentItem.setup_type] ?? null : null

  const setupOptions = useMemo(() => {
    const values = new Set(items.map((item) => item.setup_type))
    return ['ALL', ...Array.from(values).sort()]
  }, [items])

  const reviewedCount = useMemo(() => items.filter((item) => item.feedback).length, [items])
  const falsePositiveCount = useMemo(
    () => items.filter((item) => item.feedback?.outcome === 'false_positive').length,
    [items],
  )
  const validCount = useMemo(() => items.filter((item) => item.feedback?.outcome === 'valid').length, [items])

  async function loadRuns(preferredRunId?: string) {
    setLoadingRuns(true)
    try {
      const payload = await fetchRuns()
      setRuns(payload.runs)
      startTransition(() => {
        setSelectedRunId((current) => preferredRunId ?? current ?? payload.latest_run_id ?? payload.runs[0]?.run_id ?? '')
      })
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to load runs.')
    } finally {
      setLoadingRuns(false)
    }
  }

  useEffect(() => {
    void loadRuns()
  }, [])

  useEffect(() => {
    if (!selectedRunId) return
    setLoadingItems(true)
    void fetchItems({
      runId: selectedRunId,
      ticker: deferredTicker.trim() || undefined,
      setupType: setupFilter,
      reviewed: reviewedFilter,
      outcome: outcomeFilter,
    })
      .then((payload) => {
        setItems(payload.items)
        startTransition(() => {
          setSelectedChartId((current) => {
            if (payload.items.some((item) => item.chart_id === current)) return current
            return payload.items[0]?.chart_id ?? ''
          })
        })
      })
      .catch((error) => {
        setItems([])
        setStatusMessage(error instanceof Error ? error.message : 'Failed to load run items.')
      })
      .finally(() => {
        setLoadingItems(false)
      })
  }, [selectedRunId, deferredTicker, setupFilter, reviewedFilter, outcomeFilter])

  useEffect(() => {
    if (!currentItem) return
    setNotes(currentItem.feedback?.notes ?? currentItem.note?.notes ?? '')
  }, [currentItem?.chart_id, currentItem?.feedback?.notes, currentItem?.note?.notes])

  useEffect(() => {
    if (!currentItem) return
    const cached = logicCache[currentItem.setup_type]
    if (cached) {
      setLogicForm({
        summary_plain: cached.summary_plain,
        trigger_conditions: cached.trigger_conditions.join('\n'),
        common_false_positives: cached.common_false_positives.join('\n'),
      })
      return
    }

    setLogicLoading(true)
    void fetchLogic(currentItem.setup_type)
      .then((snapshot) => {
        setLogicCache((prev) => ({ ...prev, [snapshot.setup_type]: snapshot }))
        setLogicForm({
          summary_plain: snapshot.summary_plain,
          trigger_conditions: snapshot.trigger_conditions.join('\n'),
          common_false_positives: snapshot.common_false_positives.join('\n'),
        })
      })
      .catch((error) => {
        setStatusMessage(error instanceof Error ? error.message : 'Failed to load logic snapshot.')
      })
      .finally(() => setLogicLoading(false))
  }, [currentItem, logicCache])

  useEffect(() => {
    if (!activeJob || !['queued', 'running'].includes(activeJob.status)) return
    const id = window.setInterval(() => {
      void fetchJob(activeJob.job_id)
        .then((job) => {
          setActiveJob(job)
          if (job.status === 'completed') {
            setStatusMessage(`Rerun finished. Loaded ${job.item_count ?? 0} charts.`)
            void loadRuns(job.output_run_id ?? undefined)
          }
          if (job.status === 'failed') {
            setStatusMessage('Rerun failed.')
          }
        })
        .catch((error) => {
          setStatusMessage(error instanceof Error ? error.message : 'Failed to poll rerun job.')
        })
    }, 2000)

    return () => window.clearInterval(id)
  }, [activeJob])

  async function handleReview(outcome: 'valid' | 'false_positive') {
    if (!currentItem) return
    setSavingReview(true)
    try {
      const payload = await saveFeedback({
        run_id: currentItem.run_id,
        chart_id: currentItem.chart_id,
        outcome,
        notes,
      })
      setItems((prev) =>
        prev.map((item) =>
          item.chart_id === currentItem.chart_id && item.run_id === currentItem.run_id
            ? { ...item, feedback: payload.feedback, note: { ...(item.note ?? {}), ...payload.feedback } }
            : item,
        ),
      )
      setStatusMessage(`Saved ${outcome.replace('_', ' ')} review.`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to save review.')
    } finally {
      setSavingReview(false)
    }
  }

  async function handleSaveNote() {
    if (!currentItem) return
    setSavingNote(true)
    try {
      const payload = await saveNote({
        run_id: currentItem.run_id,
        chart_id: currentItem.chart_id,
        notes,
      })
      setItems((prev) =>
        prev.map((item) =>
          item.chart_id === currentItem.chart_id && item.run_id === currentItem.run_id
            ? { ...item, note: payload.note }
            : item,
        ),
      )
      setStatusMessage('Saved note.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to save note.')
    } finally {
      setSavingNote(false)
    }
  }

  async function handleSaveLogic() {
    if (!currentItem) return
    setSavingLogicState(true)
    try {
      const snapshot = await saveLogic(currentItem.setup_type, {
        summary_plain: logicForm.summary_plain.trim(),
        trigger_conditions: splitLines(logicForm.trigger_conditions),
        common_false_positives: splitLines(logicForm.common_false_positives),
      })
      setLogicCache((prev) => ({ ...prev, [snapshot.setup_type]: snapshot }))
      setStatusMessage('Saved logic summary.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to save logic summary.')
    } finally {
      setSavingLogicState(false)
    }
  }

  async function handlePrompt(action: PromptAction) {
    if (!currentItem) return
    try {
      const payload = await createPrompt({
        setupType: currentItem.setup_type,
        action,
        ticker: currentItem.ticker,
        run_id: currentItem.run_id,
        chart_id: currentItem.chart_id,
        notes,
      })
      await navigator.clipboard.writeText(payload.prompt)
      setStatusMessage(`Copied ${action.replace('_', ' ')} prompt.`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to generate prompt.')
    }
  }

  async function handleRerun(scope: 'selected_ticker_setup' | 'selected_ticker_all' | 'full_batch') {
    if (!currentItem && scope !== 'full_batch') return
    try {
      const payload = await startRerun({
        scope,
        ticker: scope === 'full_batch' ? undefined : currentItem?.ticker,
        setup_type: scope === 'selected_ticker_setup' ? currentItem?.setup_type : undefined,
        rule_version: currentRun?.rule_version ?? 'python_v1',
      })

      setActiveJob({
        job_id: payload.job_id,
        scope,
        status: 'queued',
        run_id: payload.run_id,
        ticker: currentItem?.ticker,
        setup_type: currentItem?.setup_type,
        rule_version: currentRun?.rule_version ?? 'python_v1',
      })
      setStatusMessage(`Started ${scope.replaceAll('_', ' ')} rerun.`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to start rerun.')
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <div
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(circle at top left, rgba(59,130,246,0.12), transparent 28%), radial-gradient(circle at top right, rgba(34,197,94,0.08), transparent 22%), linear-gradient(180deg, rgba(13,17,23,0.05), rgba(6,8,15,0.7))',
        }}
      />

      <div className="relative mx-auto flex h-full max-w-[1880px] flex-col gap-3 p-3 lg:p-4">
        <Card className="shrink-0 border-border bg-card/90">
          <CardContent className="space-y-3 p-3">
            <div className="grid gap-2 xl:grid-cols-[minmax(220px,1fr)_minmax(180px,0.8fr)_minmax(220px,0.9fr)_auto]">
              <Select value={selectedRunId} onValueChange={setSelectedRunId}>
                <SelectTrigger>
                  <SelectValue placeholder="Run" />
                </SelectTrigger>
                <SelectContent>
                  {runs.map((run) => (
                    <SelectItem key={run.run_id} value={run.run_id}>
                      {run.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
                <Input
                  value={tickerFilter}
                  onChange={(event) => setTickerFilter(event.target.value)}
                  placeholder="Ticker"
                  className="pl-9"
                />
              </div>

              <Select value={setupFilter} onValueChange={setSetupFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Setup" />
                </SelectTrigger>
                <SelectContent>
                  {setupOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === 'ALL' ? 'All setups' : option.replaceAll('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button className="flex-1" disabled={!currentItem} onClick={() => void handleRerun('selected_ticker_setup')}>
                  <Play className="size-4" />
                  Run again
                </Button>
                <details className="group relative">
                  <summary className="flex h-9 cursor-pointer list-none items-center justify-center rounded-md border border-input bg-card px-3 text-sm text-text-secondary transition-colors hover:border-primary/40 hover:text-text-primary">
                    More
                  </summary>
                  <div className="absolute right-0 z-20 mt-2 w-[320px] rounded-xl border border-border bg-card p-3 shadow-2xl shadow-black/30">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Select value={reviewedFilter} onValueChange={setReviewedFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All charts</SelectItem>
                          <SelectItem value="unreviewed">Unreviewed only</SelectItem>
                          <SelectItem value="reviewed">Reviewed only</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All outcomes</SelectItem>
                          <SelectItem value="valid">Valid only</SelectItem>
                          <SelectItem value="false_positive">False positives</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" disabled={!currentItem} onClick={() => void handleRerun('selected_ticker_all')}>
                        <ArrowUpRight className="size-4" />
                        This ticker
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void handleRerun('full_batch')}>
                        <FolderSync className="size-4" />
                        Full batch
                      </Button>
                    </div>
                  </div>
                </details>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge className="bg-primary/15 text-primary">{loadingRuns ? 'Loading runs...' : currentRun?.label ?? 'No run selected'}</Badge>
              <Badge variant="secondary" className="bg-secondary text-text-secondary">{items.length} charts</Badge>
              <Badge variant="secondary" className="bg-secondary text-text-secondary">{reviewedCount} reviewed</Badge>
              <Badge variant="secondary" className="bg-secondary text-text-secondary">{validCount} valid</Badge>
              <Badge className="border border-bearish/25 bg-bearish/10 text-bearish">{falsePositiveCount} false positives</Badge>
              {statusMessage ? <span className="truncate text-text-muted">{statusMessage}</span> : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
          <Card className="flex min-h-0 flex-col border-border bg-card/90">
            <CardHeader className="shrink-0 pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="font-heading text-base text-text-primary">Queue</CardTitle>
                <Badge variant="secondary">{loadingItems ? 'Loading...' : items.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 space-y-2 overflow-auto pt-0">
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-bg-surface p-3 text-sm text-text-muted">
                  No charts match this view.
                </div>
              ) : null}

              {items.map((item) => {
                const selected = currentItem?.chart_id === item.chart_id
                return (
                  <button
                    key={`${item.run_id}-${item.chart_id}`}
                    onClick={() => setSelectedChartId(item.chart_id)}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-left transition-all hover:border-primary/50 hover:bg-bg-overlay/60',
                      selected ? 'border-primary bg-primary/8' : 'border-border bg-bg-surface',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-heading text-sm text-text-primary">{item.ticker}</div>
                        <div className="truncate text-[11px] uppercase tracking-[0.14em] text-text-secondary">
                          {item.setup_type.replaceAll('_', ' ')}
                        </div>
                      </div>
                      <Badge className={cn('shrink-0 border text-[10px]', reviewTone(item.feedback?.outcome))}>
                        {item.feedback?.outcome ?? 'new'}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted">
                      <span>{item.alert_date}</span>
                      <span className="font-mono">{item.direction}</span>
                    </div>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-col border-border bg-card/90">
            <CardHeader className="shrink-0 pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <CardTitle className="font-heading truncate text-xl text-text-primary">
                    {currentItem ? `${currentItem.ticker} - ${currentItem.setup_type.replaceAll('_', ' ')}` : 'Pick a chart'}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {currentItem ? (
                      <>
                        <Badge variant="secondary">{currentItem.alert_date}</Badge>
                        <Badge variant="secondary">{currentItem.direction}</Badge>
                        <Badge variant="secondary" className="font-mono">{currentItem.alert_price}</Badge>
                        <Badge className={cn('border', reviewTone(currentItem.feedback?.outcome))}>
                          {currentItem.feedback?.outcome ?? 'needs review'}
                        </Badge>
                      </>
                    ) : null}
                  </div>
                  {currentItem ? (
                    <details className="text-xs text-text-muted">
                      <summary className="cursor-pointer list-none hover:text-text-primary">Show run details</summary>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="secondary" className="font-mono text-[11px]">{currentItem.chart_id}</Badge>
                        <Badge variant="secondary" className="font-mono text-[11px]">{currentItem.run_id}</Badge>
                        <Badge variant="secondary" className="text-[11px]">{currentItem.rule_version}</Badge>
                        <Badge variant="secondary" className="text-[11px]">{currentItem.chart_type}</Badge>
                        {currentLogic?.source_files?.map((file) => (
                          <Badge key={file} variant="outline" className="font-mono text-[11px] text-text-secondary">
                            {file}
                          </Badge>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pt-0">
              {currentItem ? (
                <>
                  <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-bg-base">
                    {currentItem.chart_type === 'html' ? (
                      <iframe
                        title={currentItem.chart_id}
                        src={assetUrl(currentItem.run_id, currentItem.chart_path)}
                        className="h-full w-full"
                      />
                    ) : (
                      <img
                        src={assetUrl(currentItem.run_id, currentItem.chart_path)}
                        alt={currentItem.chart_id}
                        className="h-full w-full object-contain"
                      />
                    )}
                  </div>

                  <div className="shrink-0 rounded-xl border border-border bg-bg-overlay/40 p-3">
                    <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        rows={3}
                        placeholder="Why is this valid, or what should change?"
                        className={textareaClassName('min-h-[84px]')}
                      />
                      <div className="grid gap-2 lg:w-[180px]">
                        <Button
                          disabled={!currentItem || savingNote}
                          variant="outline"
                          onClick={() => void handleSaveNote()}
                        >
                          {savingNote ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                          Save note
                        </Button>
                        <Button
                          disabled={!currentItem || savingReview}
                          onClick={() => void handleReview('valid')}
                          className="bg-bullish text-white hover:bg-bullish/90"
                        >
                          {savingReview ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                          Valid
                        </Button>
                        <Button
                          disabled={!currentItem || savingReview}
                          variant="destructive"
                          onClick={() => void handleReview('false_positive')}
                        >
                          {savingReview ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                          False positive
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-bg-surface text-text-muted">
                  No chart in this filtered view.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-col border-border bg-card/90">
            <CardHeader className="shrink-0 pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="font-heading text-base text-text-primary">
                  {currentLogic?.title ?? 'Logic'}
                </CardTitle>
                {currentLogic ? (
                  <Badge
                    className={cn(
                      'border text-[10px]',
                      currentLogic.source_hash_match
                        ? 'border-bullish/30 bg-bullish/10 text-bullish'
                        : 'border-warning/30 bg-warning/10 text-warning',
                    )}
                  >
                    {currentLogic.source_hash_match ? 'fresh' : 'stale'}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pt-0">
              {logicLoading ? (
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Loader2 className="size-4 animate-spin" />
                  Loading logic...
                </div>
              ) : null}

              <textarea
                value={logicForm.summary_plain}
                onChange={(event) => setLogicForm((prev) => ({ ...prev, summary_plain: event.target.value }))}
                rows={6}
                placeholder="Plain-English setup summary"
                className={textareaClassName('min-h-[120px]')}
              />

              <details className="rounded-xl border border-border bg-bg-overlay/30 p-3">
                <summary className="cursor-pointer list-none text-sm font-medium text-text-primary">Rule detail</summary>
                <div className="mt-3 space-y-3">
                  <textarea
                    value={logicForm.trigger_conditions}
                    onChange={(event) => setLogicForm((prev) => ({ ...prev, trigger_conditions: event.target.value }))}
                    rows={4}
                    placeholder="Trigger conditions"
                    className={textareaClassName('min-h-[92px]')}
                  />
                  <textarea
                    value={logicForm.common_false_positives}
                    onChange={(event) =>
                      setLogicForm((prev) => ({ ...prev, common_false_positives: event.target.value }))
                    }
                    rows={4}
                    placeholder="Common false positives"
                    className={textareaClassName('min-h-[92px]')}
                  />
                  <Button className="w-full" disabled={!currentItem || savingLogicState} onClick={() => void handleSaveLogic()}>
                    {savingLogicState ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Save logic
                  </Button>
                </div>
              </details>

              <div className="grid gap-2 sm:grid-cols-2">
                {PROMPT_ACTIONS.map((action) => {
                  const Icon = action.icon

                  return (
                    <button
                      key={action.key}
                      onClick={() => void handlePrompt(action.key)}
                      disabled={!currentItem}
                      className="flex min-h-[82px] flex-col justify-between rounded-xl border border-border bg-bg-overlay/40 p-3 text-left transition-all hover:border-primary/40 hover:bg-primary/8 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="rounded-md bg-primary/12 p-2 text-primary">
                          <Icon className="size-4" />
                        </div>
                        <Clipboard className="size-4 text-text-muted" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-text-primary">{action.label}</div>
                        <div className="mt-1 text-xs leading-4 text-text-secondary">{action.description}</div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {activeJob ? (
                <details className="rounded-xl border border-border bg-bg-overlay/30 p-3">
                  <summary className="cursor-pointer list-none text-sm font-medium text-text-primary">
                    Job {activeJob.status}
                  </summary>
                  <div className="mt-3 space-y-2 text-xs text-text-secondary">
                    <div>Started: <span className="text-text-primary">{formatWhen(activeJob.started_at)}</span></div>
                    <div>Finished: <span className="text-text-primary">{formatWhen(activeJob.finished_at)}</span></div>
                    {activeJob.stdout_tail || activeJob.stderr_tail ? (
                      <pre className="max-h-32 overflow-auto rounded-lg border border-border bg-bg-base p-3 text-[11px] text-text-secondary">
                        {activeJob.stderr_tail || activeJob.stdout_tail}
                      </pre>
                    ) : null}
                  </div>
                </details>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
