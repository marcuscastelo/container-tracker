import { describe, expect, it } from 'vitest'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import { normalizeMscSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/msc.normalizer'

const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000631'
const CONTAINER_ID = '00000000-0000-0000-0000-000000000632'

function makeSnapshot(payload: unknown): Snapshot {
  return {
    id: SNAPSHOT_ID,
    container_id: CONTAINER_ID,
    provider: 'msc',
    fetched_at: '2026-03-12T09:00:00.000Z',
    payload,
  }
}

function readNormalizerVersion(rawEvent: unknown): string | null {
  if (typeof rawEvent !== 'object' || rawEvent === null || Array.isArray(rawEvent)) return null
  if (!('normalizer_version' in rawEvent)) return null
  const value = rawEvent.normalizer_version
  if (typeof value !== 'string') return null
  return value
}

describe('MSC normalizer version metadata', () => {
  it('attaches normalizer_version to event and PodEtaDate raw_event payloads', () => {
    const payload = {
      Data: {
        CurrentDate: '12/03/2026',
        BillOfLadings: [
          {
            GeneralTrackingInfo: {
              PortOfDischarge: 'SANTOS, BR',
            },
            ContainersInfo: [
              {
                ContainerNumber: 'MSDU1652364',
                PodEtaDate: '10/05/2026',
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
    expect(drafts).toHaveLength(2)

    expect(drafts[0]?.type).toBe('LOAD')
    expect(drafts[0]?.event_time_type).toBe('ACTUAL')
    expect(readNormalizerVersion(drafts[0]?.raw_event)).toBe('msc-v3')

    expect(drafts[1]?.type).toBe('ARRIVAL')
    expect(drafts[1]?.event_time_type).toBe('EXPECTED')
    expect(readNormalizerVersion(drafts[1]?.raw_event)).toBe('msc-v3')
  })
})
