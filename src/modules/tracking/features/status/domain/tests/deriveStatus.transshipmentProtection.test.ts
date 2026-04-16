import { describe, expect, it } from 'vitest'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import { resolveTemporalValue, temporalValueFromCanonical } from '~/shared/time/tests/helpers'

const CONTAINER_ID = '00000000-0000-0000-0000-000000000302'
const CONTAINER_NUMBER = 'CA06425TEST'
const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000301'

type ObservationOverrides = Omit<Partial<Observation>, 'event_time'> & {
  readonly event_time?: string | Observation['event_time']
}

const DEFAULT_EVENT_TIME = temporalValueFromCanonical('2025-01-01T00:00:00.000Z')

function makeObs(overrides: ObservationOverrides = {}): Observation {
  const { event_time, ...rest } = overrides

  return {
    id: '00000000-0000-0000-0000-000000000399',
    fingerprint: 'fp-base',
    container_id: CONTAINER_ID,
    container_number: CONTAINER_NUMBER,
    type: 'OTHER',
    event_time: resolveTemporalValue(event_time, DEFAULT_EVENT_TIME),
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
    ...rest,
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

  it('does not keep ARRIVED_AT_POD when there is a later ACTUAL LOAD after transshipment arrival', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        id: '00000000-0000-0000-0000-000000000330',
        fingerprint: 'fp-gate-in-origin',
        type: 'GATE_IN',
        event_time: '2026-01-13T08:00:00.000Z',
        created_at: '2026-01-13T08:00:00.000Z',
        location_code: 'TZTGT',
        location_display: 'TANGA, TZ',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000331',
        fingerprint: 'fp-load-origin',
        type: 'LOAD',
        event_time: '2026-01-22T09:00:00.000Z',
        created_at: '2026-01-22T09:00:00.000Z',
        location_code: 'TZTGT',
        location_display: 'TANGA, TZ',
        vessel_name: 'ALPHA KIRAWIRA',
        voyage: '428V8S',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000332',
        fingerprint: 'fp-arrival-ts',
        type: 'ARRIVAL',
        event_time: '2026-01-27T06:00:00.000Z',
        created_at: '2026-01-27T06:00:00.000Z',
        location_code: 'KEMBA',
        location_display: 'MOMBASA, KE',
        vessel_name: 'ALPHA KIRAWIRA',
        voyage: '429V8N',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000333',
        fingerprint: 'fp-discharge-ts',
        type: 'DISCHARGE',
        event_time: '2026-01-29T07:00:00.000Z',
        created_at: '2026-01-29T07:00:00.000Z',
        location_code: 'KEMBA',
        location_display: 'MOMBASA, KE',
        vessel_name: 'ALPHA KIRAWIRA',
        voyage: '429V8N',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000334',
        fingerprint: 'fp-load-ts',
        type: 'LOAD',
        event_time: '2026-03-11T05:00:00.000Z',
        created_at: '2026-03-11T05:00:00.000Z',
        location_code: 'KEMBA',
        location_display: 'MOMBASA, KE',
        vessel_name: 'MYNY',
        voyage: '0K126E1MA',
      }),
    ])

    const status = deriveStatus(timeline)

    expect(status).toBe('LOADED')
    expect(status).not.toBe('ARRIVED_AT_POD')
  })
})
