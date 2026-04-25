import { api } from '@/lib/api-client'

export interface ManifestEntry {
  chart_id: string
  ticker: string
  setup_type: string
  alert_date: string
  alert_price: number
  window_start: string
  window_end: string
  rule_version: string
  chart_path: string
  direction: string
}

export interface LabelEntry {
  chart_id: string
  human_label: 'yes' | 'no' | 'wrong_type' | 'unsure'
  correct_type: string | null
  reviewed_at: string
  review_outcome?: 'valid' | 'false_positive' | 'unclear'
  reason_tags?: string[]
  notes?: string | null
}

export interface LabelStats {
  total: number
  labeled: number
  unlabeled: number
  byType: Record<string, { total: number; yes: number; no: number; wrong_type: number; unsure: number }>
}

export interface LabelTickerSummary {
  ticker: string
}

export interface TelegramSendNextResponse {
  sent: boolean
  reason?: string
  chart_id?: string
}

export function fetchManifest(version: string, ticker?: string): Promise<ManifestEntry[]> {
  const query = ticker ? `?ticker=${encodeURIComponent(ticker)}` : ''
  return api.get<ManifestEntry[]>(`/labels/manifest/${version}${query}`)
}

export function fetchLabelTickers(version: string): Promise<LabelTickerSummary[]> {
  return api.get<LabelTickerSummary[]>(`/labels/tickers/${version}`)
}

export function fetchLabels(version: string): Promise<LabelEntry[]> {
  return api.get<LabelEntry[]>(`/labels/labels/${version}`)
}

export function saveLabel(version: string, label: LabelEntry): Promise<{ saved: boolean; total: number }> {
  return api.post<{ saved: boolean; total: number }>(`/labels/labels/${version}`, label)
}

export function fetchLabelStats(version: string, ticker?: string): Promise<LabelStats> {
  const query = ticker ? `?ticker=${encodeURIComponent(ticker)}` : ''
  return api.get<LabelStats>(`/labels/stats/${version}${query}`)
}

export function getChartImageUrl(version: string, chartPath: string): string {
  return `/api/labels/image/${version}/${chartPath}`
}

export function sendNextToTelegram(chatId: string, version: string): Promise<TelegramSendNextResponse> {
  return api.post<TelegramSendNextResponse>('/labels/telegram/send-next', { chatId, version })
}

export function setTelegramWebhook(webhookUrl: string): Promise<unknown> {
  return api.post<unknown>('/labels/telegram/set-webhook', { webhookUrl })
}
