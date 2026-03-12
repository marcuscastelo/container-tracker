import { describe, expect, it } from 'vitest'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import { normalizeCmaCgmSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/cmacgm.normalizer'
import transshipmentTangaMombasaMyny from '~/modules/tracking/infrastructure/carriers/tests/fixtures/cmacgm/cmacgm_transshipment_tanga_mombasa_myny.json'

const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000701'
const CONTAINER_ID = '00000000-0000-0000-0000-000000000702'

function makeSnapshot(payload: unknown): Snapshot {
  return {
    id: SNAPSHOT_ID,
    container_id: CONTAINER_ID,
    provider: 'cmacgm',
    fetched_at: '2026-03-12T09:00:00.000Z',
    payload,
  }
}

describe('CMA-CGM real transshipment regression fixture', () => {
  it('normalizes the real TANGA -> MOMBASA -> MYNY sequence deterministically', () => {
    const drafts = normalizeCmaCgmSnapshot(makeSnapshot(transshipmentTangaMombasaMyny))

    expect(drafts).toHaveLength(5)
    expect(drafts.map((draft) => draft.type)).toEqual([
      'GATE_IN',
      'LOAD',
      'ARRIVAL',
      'DISCHARGE',
      'LOAD',
    ])

    expect(drafts[1]?.vessel_name).toBe('ALPHA KIRAWIRA')
    expect(drafts[1]?.voyage).toBe('428V8S')
    expect(drafts[4]?.vessel_name).toBe('MYNY')
    expect(drafts[4]?.voyage).toBe('0K126E1MA')
  })
})
