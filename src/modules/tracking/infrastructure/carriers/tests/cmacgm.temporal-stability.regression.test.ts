import { describe, expect, it } from 'vitest'
import { computeFingerprint } from '~/modules/tracking/domain/identity/fingerprint'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import { diffObservations } from '~/modules/tracking/features/observation/application/orchestration/diffObservations'
import { normalizeCmaCgmSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/cmacgm.normalizer'
import { temporalCanonicalText } from '~/shared/time/tests/helpers'

const CONTAINER_ID = '00000000-0000-0000-0000-000000000991'
const CONTAINER_NUMBER = 'MSCU9990001'

function makeSnapshot(snapshotId: string, moveDate: string): Snapshot {
  return {
    id: snapshotId,
    container_id: CONTAINER_ID,
    provider: 'cmacgm',
    fetched_at: '2026-04-18T10:00:00.000Z',
    payload: {
      ContainerReference: CONTAINER_NUMBER,
      PastMoves: [
        {
          Date: moveDate,
          DateString: 'Friday,24-APR-2026',
          TimeString: '07:00 PM',
          State: 'NONE',
          StatusDescription: 'Vessel Arrival',
          LocationCode: 'BRSSZ',
          Location: 'SANTOS',
          Vessel: 'CMA CGM LISA MARIE',
          Voyage: '0NSN7S1MA',
        },
      ],
    },
  }
}

describe('CMA-CGM temporal stability regression', () => {
  it('normalizes semantically equivalent snapshots to the same canonical temporal representation', () => {
    const snapshots = [
      makeSnapshot('00000000-0000-0000-0000-000000000101', '2026-04-24T00:00:00'),
      makeSnapshot('00000000-0000-0000-0000-000000000102', '2026-04-24T16:00:00'),
      makeSnapshot('00000000-0000-0000-0000-000000000103', '2026-04-24T19:00:00'),
    ]

    const drafts = snapshots.map((snapshot) => normalizeCmaCgmSnapshot(snapshot)[0] ?? null)
    expect(drafts).toHaveLength(3)
    for (const draft of drafts) {
      expect(draft).not.toBeNull()
      expect(draft?.event_time?.kind).toBe('local-datetime')
      expect(draft?.event_time_source).toBe('carrier_local_port_time')
      expect(draft?.raw_event_time).toBe('Friday,24-APR-2026 07:00 PM')
    }

    const canonicalTimes = drafts.map((draft) => temporalCanonicalText(draft?.event_time ?? null))
    expect(canonicalTimes).toEqual([
      '2026-04-24T19:00:00.000[America/Sao_Paulo]',
      '2026-04-24T19:00:00.000[America/Sao_Paulo]',
      '2026-04-24T19:00:00.000[America/Sao_Paulo]',
    ])
  })

  it('keeps fingerprint stable and lets diffObservations deduplicate downstream', () => {
    const snapshots = [
      makeSnapshot('00000000-0000-0000-0000-000000000201', '2026-04-24T00:00:00'),
      makeSnapshot('00000000-0000-0000-0000-000000000202', '2026-04-24T16:00:00'),
      makeSnapshot('00000000-0000-0000-0000-000000000203', '2026-04-24T19:00:00'),
    ]

    const drafts = snapshots.map((snapshot) => normalizeCmaCgmSnapshot(snapshot)[0] ?? null)
    const fingerprints = drafts.map((draft) => (draft === null ? null : computeFingerprint(draft)))
    expect(fingerprints).toEqual([fingerprints[0], fingerprints[0], fingerprints[0]])

    const [firstDraft, secondDraft, thirdDraft] = drafts
    if (firstDraft == null || secondDraft == null || thirdDraft == null) {
      throw new Error('Expected normalized drafts for all snapshots')
    }

    const existingFingerprints = new Set<string>()
    const firstBatch = diffObservations(existingFingerprints, [firstDraft], CONTAINER_ID)
    expect(firstBatch).toHaveLength(1)
    const firstFingerprint = firstBatch[0]?.fingerprint
    if (!firstFingerprint) {
      throw new Error('Expected a fingerprint in first batch')
    }
    existingFingerprints.add(firstFingerprint)

    const secondBatch = diffObservations(existingFingerprints, [secondDraft], CONTAINER_ID)
    const thirdBatch = diffObservations(existingFingerprints, [thirdDraft], CONTAINER_ID)
    expect(secondBatch).toHaveLength(0)
    expect(thirdBatch).toHaveLength(0)
  })
})
