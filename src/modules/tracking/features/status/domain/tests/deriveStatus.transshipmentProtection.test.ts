import { describe, expect, it } from 'vitest'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'

const CONTAINER_ID = '00000000-0000-0000-0000-000000000302'
const CONTAINER_NUMBER = 'CA06425TEST'
const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000301'

function makeObs(overrides: Partial<Observation> = {}): Observation {
  return {
    id: '00000000-0000-0000-0000-000000000399',
    fingerprint: 'fp-base',
    container_id: CONTAINER_ID,
    container_number: CONTAINER_NUMBER,
    type: 'OTHER',
    event_time: '2025-01-01T00:00:00.000Z',
    event_time_type: 'ACTUAL',
    location_code: 'PKKHI',
    location_display: 'KARACHI, PK',
    vessel_name: null,
    voyage: null,
    is_empty: null,
    confidence: 'high',
    provider: 'msc',
    created_from_snapshot_id: SNAPSHOT_ID,
    created_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('deriveStatus transshipment protection', () => {
  it('returns IN_TRANSIT when there is ACTUAL LOAD after candidate DISCHARGE', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        id: '00000000-0000-0000-0000-000000000310',
        fingerprint: 'fp-load-origin',
        type: 'LOAD',
        event_time: '2025-01-01T10:00:00.000Z',
        created_at: '2025-01-01T10:00:00.000Z',
        location_code: 'PKKHI',
        location_display: 'KARACHI, PK',
        vessel_name: 'VESSEL-A',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000311',
        fingerprint: 'fp-departure-origin',
        type: 'DEPARTURE',
        event_time: '2025-01-01T22:00:00.000Z',
        created_at: '2025-01-01T22:00:00.000Z',
        location_code: 'PKKHI',
        location_display: 'KARACHI, PK',
        vessel_name: 'VESSEL-A',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000312',
        fingerprint: 'fp-discharge-ts',
        type: 'DISCHARGE',
        event_time: '2025-01-20T06:00:00.000Z',
        created_at: '2025-01-20T06:00:00.000Z',
        location_code: 'KRPUS',
        location_display: 'BUSAN, KR',
        vessel_name: 'VESSEL-A',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000313',
        fingerprint: 'fp-load-ts',
        type: 'LOAD',
        event_time: '2025-01-21T06:00:00.000Z',
        created_at: '2025-01-21T06:00:00.000Z',
        location_code: 'KRPUS',
        location_display: 'BUSAN, KR',
        vessel_name: 'VESSEL-B',
      }),
    ])

    expect(deriveStatus(timeline)).toBe('IN_TRANSIT')
  })

  it('uses stable timeline ordering for equal timestamps and does not require vessel change', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        id: '00000000-0000-0000-0000-000000000320',
        fingerprint: 'fp-load-origin',
        type: 'LOAD',
        event_time: '2025-01-01T10:00:00.000Z',
        created_at: '2025-01-01T10:00:00.000Z',
        vessel_name: 'VESSEL-A',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000321',
        fingerprint: 'fp-departure-origin',
        type: 'DEPARTURE',
        event_time: '2025-01-01T22:00:00.000Z',
        created_at: '2025-01-01T22:00:00.000Z',
        vessel_name: 'VESSEL-A',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000322',
        fingerprint: 'fp-discharge-ts',
        type: 'DISCHARGE',
        event_time: '2025-01-20T06:00:00.000Z',
        created_at: '2025-01-20T06:00:00.000Z',
        location_code: 'KRPUS',
        location_display: 'BUSAN, KR',
        vessel_name: 'VESSEL-A',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000323',
        fingerprint: 'fp-load-ts-same-vessel',
        type: 'LOAD',
        event_time: '2025-01-20T06:00:00.000Z',
        created_at: '2025-01-20T06:00:01.000Z',
        location_code: 'KRPUS',
        location_display: 'BUSAN, KR',
        vessel_name: 'VESSEL-A',
      }),
    ])

    expect(deriveStatus(timeline)).toBe('IN_TRANSIT')
  })
})
