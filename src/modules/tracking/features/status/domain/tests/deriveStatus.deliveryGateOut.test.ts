import { describe, expect, it } from 'vitest'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import { resolveTemporalValue, temporalValueFromCanonical } from '~/shared/time/tests/helpers'

const CONTAINER_ID = '00000000-0000-0000-0000-000000000502'
const CONTAINER_NUMBER = 'CA08325GATEOUT'
const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000501'

type ObservationOverrides = Omit<Partial<Observation>, 'event_time'> & {
  readonly event_time?: string | Observation['event_time']
}

const DEFAULT_EVENT_TIME = temporalValueFromCanonical('2026-02-01T00:00:00.000Z')

function makeObs(overrides: ObservationOverrides = {}): Observation {
  const { event_time, ...rest } = overrides

  return {
    id: '00000000-0000-0000-0000-000000000599',
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

describe('deriveStatus terminal delivery gate-out fallback', () => {
  it('returns DELIVERED for ACTUAL DISCHARGE followed by terminal ACTUAL GATE_OUT with is_empty=false', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        id: '00000000-0000-0000-0000-000000000510',
        fingerprint: 'fp-discharge',
        type: 'DISCHARGE',
        event_time: '2026-02-03T09:00:00.000Z',
        created_at: '2026-02-03T09:00:00.000Z',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000511',
        fingerprint: 'fp-terminal-gate-out',
        type: 'GATE_OUT',
        event_time: '2026-02-04T10:00:00.000Z',
        created_at: '2026-02-04T10:00:00.000Z',
        is_empty: false,
      }),
    ])

    expect(deriveStatus(timeline)).toBe('DELIVERED')
  })

  it('does not infer DELIVERED for origin empty lifecycle GATE_OUT -> GATE_IN -> LOAD', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        id: '00000000-0000-0000-0000-000000000520',
        fingerprint: 'fp-origin-empty-gate-out',
        type: 'GATE_OUT',
        event_time: '2026-01-01T08:00:00.000Z',
        created_at: '2026-01-01T08:00:00.000Z',
        is_empty: true,
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000521',
        fingerprint: 'fp-origin-gate-in',
        type: 'GATE_IN',
        event_time: '2026-01-02T08:00:00.000Z',
        created_at: '2026-01-02T08:00:00.000Z',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000522',
        fingerprint: 'fp-origin-load',
        type: 'LOAD',
        event_time: '2026-01-03T08:00:00.000Z',
        created_at: '2026-01-03T08:00:00.000Z',
      }),
    ])

    expect(deriveStatus(timeline)).toBe('LOADED')
    expect(deriveStatus(timeline)).not.toBe('DELIVERED')
  })

  it('keeps EMPTY_RETURNED precedence for ACTUAL DISCHARGE followed by terminal ACTUAL GATE_OUT with is_empty=true', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        id: '00000000-0000-0000-0000-000000000530',
        fingerprint: 'fp-discharge',
        type: 'DISCHARGE',
        event_time: '2026-02-03T09:00:00.000Z',
        created_at: '2026-02-03T09:00:00.000Z',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000531',
        fingerprint: 'fp-empty-gate-out',
        type: 'GATE_OUT',
        event_time: '2026-02-04T10:00:00.000Z',
        created_at: '2026-02-04T10:00:00.000Z',
        is_empty: true,
      }),
    ])

    expect(deriveStatus(timeline)).toBe('EMPTY_RETURNED')
  })
})
