import { describe, expect, it } from 'vitest'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import { normalizeMscSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/msc.normalizer'

const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000621'
const CONTAINER_ID = '00000000-0000-0000-0000-000000000622'

function makeSnapshot(payload: unknown): Snapshot {
  return {
    id: SNAPSHOT_ID,
    container_id: CONTAINER_ID,
    provider: 'msc',
    fetched_at: '2026-03-12T09:00:00.000Z',
    payload,
  }
}

describe('MSC normalizer vessel/voyage eligibility', () => {
  it('nulls vessel/voyage for positioned events even with vessel-like detail', () => {
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
                    Description: 'Full Transshipment Positioned In',
                    UnLocationCode: 'KRPUS',
                    Location: 'BUSAN, KR',
                    Detail: ['MSC BIANCA SILVIA', 'UX605A'],
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
    expect(drafts[0]?.type).toBe('OTHER')
    expect(drafts[0]?.vessel_name).toBeNull()
    expect(drafts[0]?.voyage).toBeNull()
  })

  it('nulls vessel/voyage for gate events even when detail has vessel-like values', () => {
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
                    Date: '03/12/2025',
                    Description: 'Export received at CY',
                    UnLocationCode: 'PKKHI',
                    Location: 'KARACHI, PK',
                    Detail: ['MSC IRIS', 'QS551R'],
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
    expect(drafts[0]?.type).toBe('GATE_IN')
    expect(drafts[0]?.vessel_name).toBeNull()
    expect(drafts[0]?.voyage).toBeNull()
  })

  it('keeps vessel/voyage for vessel events', () => {
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
                    Date: '02/01/2026',
                    Description: 'Export Loaded on Vessel',
                    UnLocationCode: 'PKKHI',
                    Location: 'KARACHI, PK',
                    Detail: ['MSC IRIS', 'QS551R'],
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
    expect(drafts[0]?.type).toBe('LOAD')
    expect(drafts[0]?.vessel_name).toBe('MSC IRIS')
    expect(drafts[0]?.voyage).toBe('QS551R')
  })
})
