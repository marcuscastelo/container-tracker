import { describe, expect, it } from 'vitest'
import { diffObservations } from '~/modules/tracking/application/diffObservations'
import { computeFingerprint } from '~/modules/tracking/domain/fingerprint'
import type { ObservationDraft } from '~/modules/tracking/domain/observationDraft'

const CONTAINER_ID = '00000000-0000-0000-0000-000000000002'
const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000001'

function makeDraft(overrides: Partial<ObservationDraft> = {}): ObservationDraft {
  return {
    container_number: 'CXDU2058677',
    type: 'LOAD',
    event_time: '2025-11-26T00:00:00.000Z',
    location_code: 'ITNAP',
    location_display: 'NAPLES, IT',
    vessel_name: 'MSC PARIS',
    voyage: 'MZ546A',
    is_empty: false,
    confidence: 'high',
    provider: 'msc',
    snapshot_id: SNAPSHOT_ID,
    ...overrides,
  }
}

describe('diffObservations', () => {
  it('should return all drafts when no existing fingerprints', () => {
    const drafts = [makeDraft(), makeDraft({ type: 'DISCHARGE', location_code: 'ITLIV' })]
    const result = diffObservations(new Set(), drafts, CONTAINER_ID)
    expect(result).toHaveLength(2)
  })

  it('should skip drafts whose fingerprints are already known', () => {
    const draft = makeDraft()
    const fingerprint = computeFingerprint(draft)
    const existing = new Set([fingerprint])
    const result = diffObservations(existing, [draft], CONTAINER_ID)
    expect(result).toHaveLength(0)
  })

  it('should deduplicate drafts within the same batch', () => {
    const draft = makeDraft()
    const result = diffObservations(new Set(), [draft, draft, draft], CONTAINER_ID)
    expect(result).toHaveLength(1)
  })

  it('should set container_id on all new observations', () => {
    const result = diffObservations(new Set(), [makeDraft()], CONTAINER_ID)
    for (const obs of result) {
      expect(obs.container_id).toBe(CONTAINER_ID)
    }
  })

  it('should set fingerprint on all new observations', () => {
    const draft = makeDraft()
    const result = diffObservations(new Set(), [draft], CONTAINER_ID)
    expect(result[0]?.fingerprint).toBe(computeFingerprint(draft))
  })

  it('should set retroactive to false by default', () => {
    const result = diffObservations(new Set(), [makeDraft()], CONTAINER_ID)
    expect(result[0]?.retroactive).toBe(false)
  })

  it('should handle empty drafts array', () => {
    const result = diffObservations(new Set(), [], CONTAINER_ID)
    expect(result).toHaveLength(0)
  })

  it('should preserve draft fields in new observations', () => {
    const draft = makeDraft({
      vessel_name: 'MSC PARIS',
      voyage: 'MZ546A',
      is_empty: false,
      confidence: 'high',
    })
    const result = diffObservations(new Set(), [draft], CONTAINER_ID)
    const obs = result[0]
    expect(obs?.vessel_name).toBe('MSC PARIS')
    expect(obs?.voyage).toBe('MZ546A')
    expect(obs?.is_empty).toBe(false)
    expect(obs?.confidence).toBe('high')
  })
})
