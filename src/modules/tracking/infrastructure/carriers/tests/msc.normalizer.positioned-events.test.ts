import { describe, expect, it } from 'vitest'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import { normalizeMscSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/msc.normalizer'

const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000601'
const CONTAINER_ID = '00000000-0000-0000-0000-000000000602'

function makeSnapshot(payload: unknown, fetchedAt: string = '2026-02-05T00:00:00.000Z'): Snapshot {
  return {
    id: SNAPSHOT_ID,
    container_id: CONTAINER_ID,
    provider: 'msc',
    fetched_at: fetchedAt,
    payload,
  }
}

describe('MSC positioned transshipment mapping', () => {
  it.each([
    'Full Transshipment Positioned In',
    'Full Transshipment Positioned Out',
  ])('maps "%s" to TERMINAL_MOVE with null vessel and voyage', (description) => {
    const payload = {
      Data: {
        CurrentDate: '05/02/2026',
        BillOfLadings: [
          {
            ContainersInfo: [
              {
                ContainerNumber: 'MSCPOSITIONED1',
                Events: [
                  {
                    Date: '05/02/2026',
                    Description: description,
                    UnLocationCode: 'KRPUS',
                    Location: 'BUSAN, KR',
                    Detail: ['LADEN'],
                  },
                ],
              },
            ],
          },
        ],
      },
      IsSuccess: true,
    }

    const drafts = normalizeMscSnapshot(makeSnapshot(payload))
    expect(drafts).toHaveLength(1)

    const positioned = drafts[0]
    expect(positioned?.type).toBe('TERMINAL_MOVE')
    expect(positioned?.carrier_label).toBe(description)
    expect(positioned?.vessel_name).toBeNull()
    expect(positioned?.voyage).toBeNull()
  })
})
