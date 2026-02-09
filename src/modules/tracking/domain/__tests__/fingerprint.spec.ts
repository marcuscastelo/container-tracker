import { describe, expect, it } from 'vitest'
import { computeFingerprint } from '~/modules/tracking/domain/fingerprint'
import type { ObservationDraft } from '~/modules/tracking/domain/observationDraft'

function makeDraft(overrides: Partial<ObservationDraft> = {}): ObservationDraft {
  return {
    container_number: 'CXDU2058677',
    type: 'LOAD',
    event_time: '2025-11-26T00:00:00.000Z',
    event_time_type: 'ACTUAL',
    location_code: 'ITNAP',
    location_display: 'NAPLES, IT',
    vessel_name: 'MSC PARIS',
    voyage: 'MZ546A',
    is_empty: false,
    confidence: 'high',
    provider: 'msc',
    snapshot_id: '00000000-0000-0000-0000-000000000001',
    ...overrides,
  }
}

describe('computeFingerprint', () => {
  it('should produce a 32-char hex string', () => {
    const fp = computeFingerprint(makeDraft())
    expect(fp).toMatch(/^[a-f0-9]{32}$/)
  })

  it('should be deterministic (same input → same output)', () => {
    const draft = makeDraft()
    const fp1 = computeFingerprint(draft)
    const fp2 = computeFingerprint(draft)
    expect(fp1).toBe(fp2)
  })

  it('should be stable across different snapshot_ids (unstable field ignored)', () => {
    const fp1 = computeFingerprint(
      makeDraft({ snapshot_id: '00000000-0000-0000-0000-000000000001' }),
    )
    const fp2 = computeFingerprint(
      makeDraft({ snapshot_id: '00000000-0000-0000-0000-000000000099' }),
    )
    expect(fp1).toBe(fp2)
  })

  it('should be stable across different providers (unstable field ignored)', () => {
    const fp1 = computeFingerprint(makeDraft({ provider: 'msc' }))
    const fp2 = computeFingerprint(makeDraft({ provider: 'maersk' }))
    expect(fp1).toBe(fp2)
  })

  it('should be stable across different confidence levels (unstable field ignored)', () => {
    const fp1 = computeFingerprint(makeDraft({ confidence: 'high' }))
    const fp2 = computeFingerprint(makeDraft({ confidence: 'low' }))
    expect(fp1).toBe(fp2)
  })

  it('should differ when container_number changes', () => {
    const fp1 = computeFingerprint(makeDraft({ container_number: 'CXDU2058677' }))
    const fp2 = computeFingerprint(makeDraft({ container_number: 'MRKU2733926' }))
    expect(fp1).not.toBe(fp2)
  })

  it('should differ when type changes', () => {
    const fp1 = computeFingerprint(makeDraft({ type: 'LOAD' }))
    const fp2 = computeFingerprint(makeDraft({ type: 'DISCHARGE' }))
    expect(fp1).not.toBe(fp2)
  })

  it('should differ when event_time date changes', () => {
    const fp1 = computeFingerprint(makeDraft({ event_time: '2025-11-26T00:00:00.000Z' }))
    const fp2 = computeFingerprint(makeDraft({ event_time: '2025-11-27T00:00:00.000Z' }))
    expect(fp1).not.toBe(fp2)
  })

  it('should NOT differ when only the time portion changes (same date)', () => {
    const fp1 = computeFingerprint(makeDraft({ event_time: '2025-11-26T00:00:00.000Z' }))
    const fp2 = computeFingerprint(makeDraft({ event_time: '2025-11-26T12:30:00.000Z' }))
    expect(fp1).toBe(fp2)
  })

  it('should differ when location_code changes', () => {
    const fp1 = computeFingerprint(makeDraft({ location_code: 'ITNAP' }))
    const fp2 = computeFingerprint(makeDraft({ location_code: 'BRSSZ' }))
    expect(fp1).not.toBe(fp2)
  })

  it('should differ when vessel_name changes', () => {
    const fp1 = computeFingerprint(makeDraft({ vessel_name: 'MSC PARIS' }))
    const fp2 = computeFingerprint(makeDraft({ vessel_name: 'MSC BIANCA' }))
    expect(fp1).not.toBe(fp2)
  })

  it('should handle null event_time gracefully', () => {
    const fp = computeFingerprint(makeDraft({ event_time: null }))
    expect(fp).toMatch(/^[a-f0-9]{32}$/)
  })

  it('should handle null location_code gracefully', () => {
    const fp = computeFingerprint(makeDraft({ location_code: null }))
    expect(fp).toMatch(/^[a-f0-9]{32}$/)
  })

  it('should handle null vessel_name gracefully', () => {
    const fp = computeFingerprint(makeDraft({ vessel_name: null }))
    expect(fp).toMatch(/^[a-f0-9]{32}$/)
  })

  it('should be case-insensitive for container_number', () => {
    const fp1 = computeFingerprint(makeDraft({ container_number: 'CXDU2058677' }))
    const fp2 = computeFingerprint(makeDraft({ container_number: 'cxdu2058677' }))
    expect(fp1).toBe(fp2)
  })

  it('should be case-insensitive for vessel_name', () => {
    const fp1 = computeFingerprint(makeDraft({ vessel_name: 'MSC PARIS' }))
    const fp2 = computeFingerprint(makeDraft({ vessel_name: 'msc paris' }))
    expect(fp1).toBe(fp2)
  })
})
