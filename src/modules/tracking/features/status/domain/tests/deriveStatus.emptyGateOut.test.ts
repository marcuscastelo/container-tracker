import { describe, expect, it } from 'vitest'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import { resolveTemporalValue, temporalValueFromCanonical } from '~/shared/time/tests/helpers'

const CONTAINER_ID = '00000000-0000-0000-0000-000000000402'
const CONTAINER_NUMBER = 'CA08325TEST'
const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000401'

type ObservationOverrides = Omit<Partial<Observation>, 'event_time'> & {
  readonly event_time?: string | Observation['event_time']
}

const DEFAULT_EVENT_TIME = temporalValueFromCanonical('2026-02-01T00:00:00.000Z')

function makeObs(overrides: ObservationOverrides = {}): Observation {
  const { event_time, ...rest } = overrides

  return {
    id: '00000000-0000-0000-0000-000000000499',
    fingerprint: 'fp-base',
    container_id: CONTAINER_ID,
    container_number: CONTAINER_NUMBER,
    type: 'OTHER',
    event_time: resolveTemporalValue(event_time, DEFAULT_EVENT_TIME),
    event_time_type: 'ACTUAL',
    location_code: 'BRSSZ',
    location_display: 'SANTOS, BR',
    vessel_name: null,
    voyage: null,
    is_empty: null,
    confidence: 'high',
    provider: 'maersk',
    created_from_snapshot_id: SNAPSHOT_ID,
    created_at: '2026-02-01T00:00:00.000Z',
    ...rest,
  }
}

describe('deriveStatus empty gate-out fallback', () => {
  it('returns EMPTY_RETURNED for terminal ACTUAL GATE_OUT with is_empty=true after DISCHARGE', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        id: '00000000-0000-0000-0000-000000000410',
        fingerprint: 'fp-discharge-pod',
        type: 'DISCHARGE',
        event_time: '2026-02-01T09:00:00.000Z',
        created_at: '2026-02-01T09:00:00.000Z',
        location_code: 'BRSSZ',
        location_display: 'SANTOS, BR',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000411',
        fingerprint: 'fp-empty-gate-out',
        type: 'GATE_OUT',
        event_time: '2026-02-03T10:00:00.000Z',
        created_at: '2026-02-03T10:00:00.000Z',
        location_code: 'BRSSZ',
        location_display: 'SANTOS, BR',
        is_empty: true,
      }),
    ])

    expect(deriveStatus(timeline)).toBe('EMPTY_RETURNED')
  })

  it('does not treat origin empty gate-out as EMPTY_RETURNED before import lifecycle', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        id: '00000000-0000-0000-0000-000000000420',
        fingerprint: 'fp-empty-to-shipper',
        type: 'GATE_OUT',
        event_time: '2026-01-10T08:00:00.000Z',
        created_at: '2026-01-10T08:00:00.000Z',
        location_code: 'ITNAP',
        location_display: 'NAPLES, IT',
        is_empty: true,
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000421',
        fingerprint: 'fp-gate-in-origin',
        type: 'GATE_IN',
        event_time: '2026-01-12T08:00:00.000Z',
        created_at: '2026-01-12T08:00:00.000Z',
        location_code: 'ITNAP',
        location_display: 'NAPLES, IT',
        is_empty: false,
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000422',
        fingerprint: 'fp-load-origin',
        type: 'LOAD',
        event_time: '2026-01-13T08:00:00.000Z',
        created_at: '2026-01-13T08:00:00.000Z',
        location_code: 'ITNAP',
        location_display: 'NAPLES, IT',
        is_empty: false,
      }),
    ])

    expect(deriveStatus(timeline)).toBe('LOADED')
  })

  it('does not override a later canonical DELIVERY event', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        id: '00000000-0000-0000-0000-000000000430',
        fingerprint: 'fp-discharge-pod',
        type: 'DISCHARGE',
        event_time: '2026-02-01T09:00:00.000Z',
        created_at: '2026-02-01T09:00:00.000Z',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000431',
        fingerprint: 'fp-empty-gate-out',
        type: 'GATE_OUT',
        event_time: '2026-02-03T10:00:00.000Z',
        created_at: '2026-02-03T10:00:00.000Z',
        is_empty: true,
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000432',
        fingerprint: 'fp-delivery-later',
        type: 'DELIVERY',
        event_time: '2026-02-04T10:00:00.000Z',
        created_at: '2026-02-04T10:00:00.000Z',
      }),
    ])

    expect(deriveStatus(timeline)).toBe('DELIVERED')
  })
})
