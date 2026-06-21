import { describe, expect, it } from 'vitest'
import { buildSetupAuditItemsQuery } from '@/lib/api/research'
import {
  extractModelReviewSummary,
  formatAuditReasonCode,
  parseDetectedSetups,
  toStringArray,
} from './setup-audit.selectors'

describe('setup audit selectors', () => {
  it('builds stable setup audit query params', () => {
    const query = buildSetupAuditItemsQuery({
      page: 2,
      limit: 24,
      scanStatus: 'DETECTED',
      focusStatus: 'INCLUDED',
      setupType: 'VCP',
      q: 'NVDA',
    })

    expect(query).toBe('page=2&limit=24&scanStatus=DETECTED&focusStatus=INCLUDED&setupType=VCP&q=NVDA')
  })

  it('parses detected setup card data defensively', () => {
    expect(
      parseDetectedSetups([
        { type: 'VCP', direction: 'LONG', timeframe: 'DAILY' },
        { direction: 'LONG' },
        null,
      ]),
    ).toEqual([{ type: 'VCP', direction: 'LONG', timeframe: 'DAILY' }])
  })

  it('formats reason chips for card rendering', () => {
    expect(toStringArray(['LOW_VOLUME', 1, 'NO_DETECTOR_MATCH'])).toEqual([
      'LOW_VOLUME',
      'NO_DETECTOR_MATCH',
    ])
    expect(formatAuditReasonCode('NO_DETECTOR_MATCH')).toBe('no detector match')
  })

  it('extracts model and visual review verdict reasons', () => {
    expect(
      extractModelReviewSummary({
        reviewStatus: 'REJECT',
        reasons: ['Too extended'],
        visualReasons: ['Messy base'],
        acceptReasons: ['Strong RS'],
        rejectionReasons: ['Weak group'],
      }),
    ).toEqual({
      verdict: 'REJECT',
      decision: 'reject',
      reasons: ['Too extended', 'Messy base'],
      acceptReasons: ['Strong RS'],
      rejectReasons: ['Weak group'],
    })
  })
})
