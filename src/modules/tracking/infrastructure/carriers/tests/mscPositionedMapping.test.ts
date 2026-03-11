import { describe, expect, it } from 'vitest'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import { normalizeMscSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/msc.normalizer'

const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000501'
const CONTAINER_ID = '00000000-0000-0000-0000-000000000502'
const CONTAINER_NUMBER = 'MSCPOSITIONED1'

function makeSnapshot(payload: unknown, fetchedAt: string = '2026-02-05T00:00:00.000Z'): Snapshot {
  return {
    id: SNAPSHOT_ID,
    container_id: CONTAINER_ID,
    provider: 'msc',
    fetched_at: fetchedAt,
    payload,
  }
}

function findPositionedDraftType(snapshot: Snapshot): string | undefined {
  const drafts = normalizeMscSnapshot(snapshot)
  const positioned = drafts.find((draft) => draft.carrier_label === 'Full Transshipment Positioned In')
  return positioned?.type
}

describe('MSC positioned-in mapping', () => {
  it('maps "Full Transshipment Positioned In" to LOAD when vessel_change evidence exists', () => {
    const payload = {
      Data: {
        CurrentDate: '05/02/2026',
        BillOfLadings: [
          {
            ContainersInfo: [
              {
                ContainerNumber: CONTAINER_NUMBER,
                Events: [
                  {
                    Date: '05/02/2026',
                    Description: 'Full Transshipment Positioned In',
                    UnLocationCode: 'KRPUS',
                    Location: 'BUSAN, KR',
                    Detail: ['MSC BETA', 'VY2'],
                    Vessel: { IMO: '222', Flag: 'LR', Built: '2018', FlagName: 'LIBERIA' },
                  },
                  {
                    Date: '04/02/2026',
                    Description: 'Full Transshipment Discharged',
                    UnLocationCode: 'KRPUS',
                    Location: 'BUSAN, KR',
                    Detail: ['MSC ALPHA', 'VY1'],
                    Vessel: { IMO: '111', Flag: 'LR', Built: '2015', FlagName: 'LIBERIA' },
                  },
                ],
              },
            ],
          },
        ],
      },
      IsSuccess: true,
    }

    const type = findPositionedDraftType(makeSnapshot(payload))
    expect(type).toBe('LOAD')
    expect(type).not.toBe('OTHER')
  })

  it('maps "Full Transshipment Positioned In" to ARRIVAL when vessel_change evidence is absent', () => {
    const payload = {
      Data: {
        CurrentDate: '05/02/2026',
        BillOfLadings: [
          {
            ContainersInfo: [
              {
                ContainerNumber: CONTAINER_NUMBER,
                Events: [
                  {
                    Date: '05/02/2026',
                    Description: 'Full Transshipment Positioned In',
                    UnLocationCode: 'KRPUS',
                    Location: 'BUSAN, KR',
                    Detail: ['MSC ALPHA', 'VY1'],
                    Vessel: { IMO: '111', Flag: 'LR', Built: '2015', FlagName: 'LIBERIA' },
                  },
                  {
                    Date: '04/02/2026',
                    Description: 'Full Transshipment Discharged',
                    UnLocationCode: 'KRPUS',
                    Location: 'BUSAN, KR',
                    Detail: ['MSC ALPHA', 'VY1'],
                    Vessel: { IMO: '111', Flag: 'LR', Built: '2015', FlagName: 'LIBERIA' },
                  },
                ],
              },
            ],
          },
        ],
      },
      IsSuccess: true,
    }

    const type = findPositionedDraftType(makeSnapshot(payload))
    expect(type).toBe('ARRIVAL')
    expect(type).not.toBe('OTHER')
  })
})
