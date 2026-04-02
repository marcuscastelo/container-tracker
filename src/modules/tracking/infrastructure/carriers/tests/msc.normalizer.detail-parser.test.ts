import { describe, expect, it } from 'vitest'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import { normalizeMscSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/msc.normalizer'

const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000651'
const CONTAINER_ID = '00000000-0000-0000-0000-000000000652'

function makeSnapshot(payload: unknown): Snapshot {
  return {
    id: SNAPSHOT_ID,
    container_id: CONTAINER_ID,
    provider: 'msc',
    fetched_at: '2026-03-12T09:00:00.000Z',
    payload,
  }
}

describe('MSC detail contextual parser', () => {
  it('parses vessel context for LOAD events', () => {
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
                    Detail: ['  MSC IRIS  ', '  QS551R  '],
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

    const draft = drafts[0]
    expect(draft?.type).toBe('LOAD')
    expect(draft?.vessel_name).toBe('MSC IRIS')
    expect(draft?.voyage).toBe('QS551R')
  })

  it('normalizes blank voyage detail to null', () => {
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
                    Detail: ['MSC IRIS', '   '],
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
    expect(drafts[0]?.voyage).toBeNull()
  })

  it('parses load-state context for positioned transshipment helper events', () => {
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

    const draft = drafts[0]
    expect(draft?.type).toBe('TRANSSHIPMENT_POSITIONED_IN')
    expect(draft?.is_empty).toBe(false)
    expect(draft?.vessel_name).toBeNull()
    expect(draft?.voyage).toBeNull()
  })

  it('parses EMPTY load-state for GATE_OUT events', () => {
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
                    Date: '30/11/2025',
                    Description: 'Empty to Shipper',
                    UnLocationCode: 'PKLYP',
                    Location: 'FAISALABAD, PK',
                    Detail: ['EMPTY'],
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

    const draft = drafts[0]
    expect(draft?.type).toBe('GATE_OUT')
    expect(draft?.is_empty).toBe(true)
  })

  it('keeps corruption guard for LOAD with LADEN detail', () => {
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
                    Detail: ['LADEN', 'UX605A'],
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

    const draft = drafts[0]
    expect(draft?.type).toBe('LOAD')
    expect(draft?.vessel_name).toBeNull()
    expect(draft?.voyage).toBe('UX605A')
    expect(draft?.is_empty).toBe(false)
  })
})
