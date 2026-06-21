import type { SetupAuditDetectedSetup } from '@/lib/api/research'

export type ModelDecision = 'accept' | 'reject' | 'watch' | 'unknown'

export interface ModelReviewSummary {
  verdict: string | null
  decision: ModelDecision
  reasons: string[]
  acceptReasons: string[]
  rejectReasons: string[]
}

export function parseDetectedSetups(value: unknown): SetupAuditDetectedSetup[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is SetupAuditDetectedSetup => {
    return item != null && typeof item === 'object' && typeof (item as SetupAuditDetectedSetup).type === 'string'
  })
}

export function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function formatAuditReasonCode(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase()
}

export function extractModelReviewSummary(value: unknown): ModelReviewSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      verdict: null,
      decision: 'unknown',
      reasons: [],
      acceptReasons: [],
      rejectReasons: [],
    }
  }

  const record = value as Record<string, unknown>
  const verdict =
    firstString(record.reviewStatus) ??
    firstString(record.verdict) ??
    firstString(record.direction) ??
    null
  const reasons = uniqueStrings([
    ...stringArray(record.reasons),
    ...stringArray(record.visualReasons),
    ...stringArray(record.dataframeReasons),
    ...stringArray(record.modelReasons),
    ...singleStringArray(record.reason),
    ...singleStringArray(record.rationale),
  ])
  const acceptReasons = uniqueStrings([
    ...stringArray(record.acceptReasons),
    ...stringArray(record.acceptReason),
    ...stringArray(record.positiveReasons),
  ])
  const rejectReasons = uniqueStrings([
    ...stringArray(record.rejectReasons),
    ...stringArray(record.rejectReason),
    ...stringArray(record.rejectionReasons),
    ...stringArray(record.negativeReasons),
  ])

  return {
    verdict,
    decision: classifyModelDecision(verdict),
    reasons,
    acceptReasons,
    rejectReasons,
  }
}

function classifyModelDecision(value: string | null): ModelDecision {
  const normalized = value?.toUpperCase()
  if (!normalized) return 'unknown'
  if (['FOCUS', 'LONG', 'SHORT', 'ACCEPT', 'ACCEPTED', 'PASS'].includes(normalized)) {
    return 'accept'
  }
  if (['REJECT', 'AVOID', 'REJECTED', 'FAIL'].includes(normalized)) {
    return 'reject'
  }
  if (['WATCH', 'UNDECIDED', 'NEEDS_VISUAL_REVIEW'].includes(normalized)) {
    return 'watch'
  }
  return 'unknown'
}

function firstString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }
  return []
}

function singleStringArray(value: unknown): string[] {
  const text = firstString(value)
  return text ? [text] : []
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
