export interface RunSummary {
  run_id: string
  label: string
  rule_version: string
  job_scope: string
  item_count: number
  started_at?: string | null
  finished_at?: string | null
  updated_at?: string | null
}

export interface FeedbackRecord {
  run_id: string
  chart_id: string
  ticker: string
  setup_type: string
  outcome: 'valid' | 'false_positive'
  notes: string
  reviewed_at: string
  updated_at?: string
}

export interface NoteRecord {
  run_id: string
  chart_id: string
  ticker: string
  setup_type: string
  notes: string
  saved_at?: string
  updated_at?: string
}

export interface ReviewItem {
  run_id: string
  chart_id: string
  ticker: string
  setup_type: string
  alert_date: string
  alert_price: number
  window_start: string
  window_end: string
  rule_version: string
  chart_path: string
  chart_type: string
  direction: string
  feedback?: FeedbackRecord | null
  note?: NoteRecord | null
}

export interface LogicSnapshot {
  setup_type: string
  title: string
  source_files: string[]
  source_hash: string
  source_hash_current: string
  source_hash_match: boolean
  summary_plain: string
  trigger_conditions: string[]
  common_false_positives: string[]
  updated_at?: string | null
  origin?: string
}

export interface JobStatus {
  job_id: string
  scope: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  run_id: string
  ticker?: string | null
  setup_type?: string | null
  rule_version: string
  started_at?: string | null
  finished_at?: string | null
  stdout_tail?: string
  stderr_tail?: string
  error?: string | null
  output_run_id?: string | null
  item_count?: number
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function fetchRuns(): Promise<{ runs: RunSummary[]; latest_run_id: string | null }> {
  return request('/api/runs')
}

export async function fetchItems(params: {
  runId: string
  ticker?: string
  setupType?: string
  reviewed?: string
  outcome?: string
}): Promise<{ items: ReviewItem[]; total: number }> {
  const query = new URLSearchParams()
  if (params.ticker) query.set('ticker', params.ticker)
  if (params.setupType && params.setupType !== 'ALL') query.set('setup_type', params.setupType)
  if (params.reviewed && params.reviewed !== 'all') query.set('reviewed', params.reviewed)
  if (params.outcome && params.outcome !== 'all') query.set('outcome', params.outcome)
  const qs = query.toString()
  return request(`/api/runs/${params.runId}/items${qs ? `?${qs}` : ''}`)
}

export async function fetchLogic(setupType: string): Promise<LogicSnapshot> {
  return request(`/api/logic/${setupType}`)
}

export async function saveLogic(setupType: string, payload: Pick<LogicSnapshot, 'summary_plain' | 'trigger_conditions' | 'common_false_positives'>): Promise<LogicSnapshot> {
  return request(`/api/logic/${setupType}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function createPrompt(payload: {
  setupType: string
  action: 'explain' | 'revise' | 'split' | 'refresh_summary'
  ticker?: string
  run_id?: string
  chart_id?: string
  notes?: string
}): Promise<{ prompt: string }> {
  return request(`/api/logic/${payload.setupType}/prompt`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function saveFeedback(payload: {
  run_id: string
  chart_id: string
  outcome: 'valid' | 'false_positive'
  notes: string
}): Promise<{ saved: boolean; feedback: FeedbackRecord }> {
  return request('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function saveNote(payload: {
  run_id: string
  chart_id: string
  notes: string
}): Promise<{ saved: boolean; note: NoteRecord }> {
  return request('/api/note', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function startRerun(payload: {
  scope: 'selected_ticker_setup' | 'selected_ticker_all' | 'full_batch'
  ticker?: string
  setup_type?: string
  rule_version?: string
}): Promise<{ job_id: string; run_id: string; status: string }> {
  return request('/api/rerun', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchJob(jobId: string): Promise<JobStatus> {
  return request(`/api/jobs/${jobId}`)
}

export function assetUrl(runId: string, chartPath: string): string {
  return `/api/assets/${runId}/${chartPath}`
}
