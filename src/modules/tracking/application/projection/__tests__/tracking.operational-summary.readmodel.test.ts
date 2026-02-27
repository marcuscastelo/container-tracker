import { describe, expect, it } from 'vitest'
import {
  deriveTrackingOperationalSummary,
  type TrackingObservationForOperationalSummary,
} from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'

function makeObservation(
  overrides: Partial<TrackingObservationForOperationalSummary> = {},
): TrackingObservationForOperationalSummary {
  return {
    id: 'obs-1',
    type: 'ARRIVAL',
    event_time: '2026-02-20T10:00:00.000Z',
    event_time_type: 'EXPECTED',
    location_code: 'BRSSZ',
    location_display: 'Santos',
    vessel_name: null,
    voyage: null,
    created_at: '2026-02-10T10:00:00.000Z',
    ...overrides,
  }
}

describe('deriveTrackingOperationalSummary', () => {
  it('marks future EXPECTED ETA as ACTIVE_EXPECTED', () => {
    const summary = deriveTrackingOperationalSummary({
      observations: [makeObservation()],
      status: 'IN_TRANSIT',
      transshipment: {
        hasTransshipment: false,
        transshipmentCount: 0,
        ports: [],
      },
      now: new Date('2026-02-15T00:00:00.000Z'),
    })

    expect(summary.eta?.state).toBe('ACTIVE_EXPECTED')
    expect(summary.eta?.eventTimeType).toBe('EXPECTED')
    expect(summary.eta?.type).toBe('ARRIVAL')
  })

  it('marks past EXPECTED ETA as EXPIRED_EXPECTED', () => {
    const summary = deriveTrackingOperationalSummary({
      observations: [
        makeObservation({
          event_time: '2026-02-10T10:00:00.000Z',
        }),
      ],
      status: 'IN_TRANSIT',
      transshipment: {
        hasTransshipment: false,
        transshipmentCount: 0,
        ports: [],
      },
      now: new Date('2026-02-15T00:00:00.000Z'),
    })

    expect(summary.eta?.state).toBe('EXPIRED_EXPECTED')
  })

  it('prefers ACTUAL as safe-first primary when available', () => {
    const summary = deriveTrackingOperationalSummary({
      observations: [
        makeObservation({
          id: 'obs-expected',
          event_time: '2026-02-20T10:00:00.000Z',
          event_time_type: 'EXPECTED',
        }),
        makeObservation({
          id: 'obs-actual',
          event_time: '2026-02-18T08:00:00.000Z',
          event_time_type: 'ACTUAL',
          created_at: '2026-02-18T08:00:00.000Z',
        }),
      ],
      status: 'ARRIVED_AT_POD',
      transshipment: {
        hasTransshipment: false,
        transshipmentCount: 0,
        ports: [],
      },
      now: new Date('2026-02-19T00:00:00.000Z'),
    })

    expect(summary.eta?.eventTimeType).toBe('ACTUAL')
    expect(summary.eta?.state).toBe('ACTUAL')
    expect(summary.eta?.eventTimeIso).toBe('2026-02-18T08:00:00.000Z')
  })

  it('falls back to DISCHARGE milestone when ARRIVAL is absent', () => {
    const summary = deriveTrackingOperationalSummary({
      observations: [
        makeObservation({
          id: 'obs-discharge',
          type: 'DISCHARGE',
          event_time: '2026-02-22T10:00:00.000Z',
          event_time_type: 'EXPECTED',
          location_code: 'BRSSZ',
          location_display: 'Santos',
        }),
      ],
      status: 'IN_TRANSIT',
      transshipment: {
        hasTransshipment: false,
        transshipmentCount: 0,
        ports: [],
      },
      now: new Date('2026-02-15T00:00:00.000Z'),
    })

    expect(summary.eta?.type).toBe('DISCHARGE')
    expect(summary.eta?.eventTimeIso).toBe('2026-02-22T10:00:00.000Z')
  })

  it('returns null ETA when no arrival/discharge/delivery series exist', () => {
    const summary = deriveTrackingOperationalSummary({
      observations: [
        makeObservation({
          id: 'obs-load',
          type: 'LOAD',
          location_code: 'CNSHA',
          location_display: 'Shanghai',
        }),
      ],
      status: 'LOADED',
      transshipment: {
        hasTransshipment: false,
        transshipmentCount: 0,
        ports: [],
      },
      now: new Date('2026-02-15T00:00:00.000Z'),
    })

    expect(summary.eta).toBeNull()
  })

  it('normalizes transshipment ports to intermediate ports only', () => {
    const summary = deriveTrackingOperationalSummary({
      observations: [
        makeObservation({
          id: 'obs-pol',
          type: 'LOAD',
          location_code: 'CNSHA',
          location_display: 'Shanghai',
          event_time_type: 'ACTUAL',
          event_time: '2026-02-01T00:00:00.000Z',
          created_at: '2026-02-01T00:00:00.000Z',
        }),
        makeObservation({
          id: 'obs-mid',
          type: 'DISCHARGE',
          location_code: 'ITLIV',
          location_display: 'Livorno',
          event_time_type: 'ACTUAL',
          event_time: '2026-02-10T00:00:00.000Z',
          created_at: '2026-02-10T00:00:00.000Z',
        }),
        makeObservation({
          id: 'obs-pod',
          type: 'DISCHARGE',
          location_code: 'BRSSZ',
          location_display: 'Santos',
          event_time_type: 'ACTUAL',
          event_time: '2026-02-18T00:00:00.000Z',
          created_at: '2026-02-18T00:00:00.000Z',
        }),
      ],
      status: 'DISCHARGED',
      transshipment: {
        hasTransshipment: true,
        transshipmentCount: 1,
        ports: ['CNSHA', 'ITLIV', 'BRSSZ'],
      },
      now: new Date('2026-02-20T00:00:00.000Z'),
    })

    expect(summary.transshipment.hasTransshipment).toBe(true)
    expect(summary.transshipment.count).toBe(1)
    expect(summary.transshipment.ports).toEqual([{ code: 'ITLIV', display: 'Livorno' }])
  })
})
