import { describe, expect, it } from 'vitest'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import { normalizeMscSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/msc.normalizer'

const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000611'
const CONTAINER_ID = '00000000-0000-0000-0000-000000000612'

function makeSnapshot(payload: unknown): Snapshot {
  return {
    id: SNAPSHOT_ID,
    container_id: CONTAINER_ID,
    provider: 'msc',
    fetched_at: '2026-03-12T09:00:00.000Z',
    payload,
  }
}

describe('MSC normalizer invalid vessel names', () => {
  it.each(['LADEN', 'EMPTY'])('ignores %s as vessel name', (invalidValue) => {
    const payload = {
      Data: {
        CurrentDate: '12/03/2026',
        BillOfLadings: [
          {
            ContainersInfo: [
              {
                ContainerNumber: 'MSDU1652364',
                Events: [
                  {
                    Date: '28/02/2026',
                    Description: 'Full Transshipment Loaded',
                    UnLocationCode: 'KRPUS',
                    Location: 'BUSAN, KR',
                    Detail: [invalidValue, 'UX605A'],
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

    const load = drafts[0]
    expect(load?.type).toBe('LOAD')
    expect(load?.vessel_name).toBeNull()
    expect(load?.voyage).toBe('UX605A')
  })
})
