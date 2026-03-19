import { describe, expect, it } from 'vitest'
import {
  deriveTrackingOperationalSummary,
  type TrackingObservationForOperationalSummary,
} from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import {
  instantFromIsoText,
  resolveTemporalValue,
  temporalCanonicalText,
  temporalValueFromCanonical,
} from '~/shared/time/tests/helpers'

type ObservationOverrides = Omit<
  Partial<TrackingObservationForOperationalSummary>,
  'event_time'
> & {
  readonly event_time?: string | TrackingObservationForOperationalSummary['event_time']
}

const DEFAULT_EVENT_TIME = temporalValueFromCanonical('2026-02-20T10:00:00.000Z')

function makeObservation(
  overrides: ObservationOverrides = {},
): TrackingObservationForOperationalSummary {
  const { event_time, ...rest } = overrides

  return {
    id: 'obs-1',
    type: 'ARRIVAL',
    event_time: resolveTemporalValue(event_time, DEFAULT_EVENT_TIME),
    event_time_type: 'EXPECTED',
    location_code: 'BRSSZ',
    location_display: 'Santos',
    vessel_name: null,
    voyage: null,
    created_at: '2026-02-10T10:00:00.000Z',
    ...rest,
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
      podLocationCode: 'BRSSZ',
      now: instantFromIsoText('2026-02-15T00:00:00.000Z'),
    })

    expect(summary.eta?.state).toBe('ACTIVE_EXPECTED')
    expect(summary.eta?.eventTimeType).toBe('EXPECTED')
    expect(summary.eta?.type).toBe('ARRIVAL')
    expect(summary.etaApplicable).toBe(true)
    expect(summary.lifecycleBucket).toBe('pre_arrival')
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
      podLocationCode: 'BRSSZ',
      now: instantFromIsoText('2026-02-15T00:00:00.000Z'),
    })

    expect(summary.eta?.state).toBe('EXPIRED_EXPECTED')
    expect(summary.etaApplicable).toBe(true)
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
      status: 'IN_TRANSIT',
      transshipment: {
        hasTransshipment: false,
        transshipmentCount: 0,
        ports: [],
      },
      podLocationCode: 'BRSSZ',
      now: instantFromIsoText('2026-02-19T00:00:00.000Z'),
    })

    expect(summary.eta?.eventTimeType).toBe('ACTUAL')
    expect(summary.eta?.state).toBe('ACTUAL')
    expect(temporalCanonicalText(summary.eta?.eventTime ?? null)).toBe('2026-02-18T08:00:00.000Z')
  })

  it('forces eta=null at and after ARRIVED_AT_POD', () => {
    const statuses = [
      'ARRIVED_AT_POD',
      'DISCHARGED',
      'AVAILABLE_FOR_PICKUP',
      'DELIVERED',
      'EMPTY_RETURNED',
    ]

    for (const status of statuses) {
      const summary = deriveTrackingOperationalSummary({
        observations: [makeObservation()],
        status,
        transshipment: {
          hasTransshipment: false,
          transshipmentCount: 0,
          ports: [],
        },
        podLocationCode: 'BRSSZ',
        now: instantFromIsoText('2026-02-15T00:00:00.000Z'),
      })

      expect(summary.eta).toBeNull()
      expect(summary.etaApplicable).toBe(false)
    }
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
      podLocationCode: 'BRSSZ',
      now: instantFromIsoText('2026-02-15T00:00:00.000Z'),
    })

    expect(summary.eta?.type).toBe('DISCHARGE')
    expect(temporalCanonicalText(summary.eta?.eventTime ?? null)).toBe('2026-02-22T10:00:00.000Z')
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
      podLocationCode: 'BRSSZ',
      now: instantFromIsoText('2026-02-15T00:00:00.000Z'),
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
      podLocationCode: 'BRSSZ',
      now: instantFromIsoText('2026-02-20T00:00:00.000Z'),
    })

    expect(summary.transshipment.hasTransshipment).toBe(true)
    expect(summary.transshipment.count).toBe(1)
    expect(summary.transshipment.ports).toEqual([{ code: 'ITLIV', display: 'Livorno' }])
  })

  it('ignores arrival actual at transshipment port and keeps expected arrival at POD', () => {
    const summary = deriveTrackingOperationalSummary({
      observations: [
        makeObservation({
          id: 'arrival-ts-actual',
          type: 'ARRIVAL',
          event_time_type: 'ACTUAL',
          event_time: '2026-02-13T10:00:00.000Z',
          location_code: 'ESBCN07',
          location_display: 'Barcelona',
          created_at: '2026-02-13T10:00:00.000Z',
        }),
        makeObservation({
          id: 'arrival-pod-expected',
          type: 'ARRIVAL',
          event_time_type: 'EXPECTED',
          event_time: '2026-03-08T10:00:00.000Z',
          location_code: 'BRSSZBT',
          location_display: 'Santos',
          created_at: '2026-02-14T10:00:00.000Z',
        }),
      ],
      status: 'IN_TRANSIT',
      transshipment: {
        hasTransshipment: true,
        transshipmentCount: 1,
        ports: ['ESBCN07'],
      },
      podLocationCode: 'BRSSZBT',
      now: instantFromIsoText('2026-02-20T00:00:00.000Z'),
    })

    expect(summary.eta).not.toBeNull()
    expect(temporalCanonicalText(summary.eta?.eventTime ?? null)).toBe('2026-03-08T10:00:00.000Z')
    expect(summary.eta?.eventTimeType).toBe('EXPECTED')
    expect(summary.eta?.state).toBe('ACTIVE_EXPECTED')
    expect(summary.eta?.locationCode).toBe('BRSSZBT')
  })

  it('matches POD code by UN/LOCODE root when observation has terminal suffix', () => {
    const summary = deriveTrackingOperationalSummary({
      observations: [
        makeObservation({
          id: 'arrival-pod-expected-suffix',
          type: 'ARRIVAL',
          event_time_type: 'EXPECTED',
          event_time: '2026-03-08T10:00:00.000Z',
          location_code: 'BRSSZBT',
          location_display: 'Santos',
          created_at: '2026-02-14T10:00:00.000Z',
        }),
      ],
      status: 'IN_TRANSIT',
      transshipment: {
        hasTransshipment: false,
        transshipmentCount: 0,
        ports: [],
      },
      podLocationCode: 'BRSSZ',
      now: instantFromIsoText('2026-02-20T00:00:00.000Z'),
    })

    expect(summary.eta).not.toBeNull()
    expect(temporalCanonicalText(summary.eta?.eventTime ?? null)).toBe('2026-03-08T10:00:00.000Z')
    expect(summary.eta?.locationCode).toBe('BRSSZBT')
  })

  it('uses safe fallback when POD code is missing: latest expected ARRIVAL only', () => {
    const summary = deriveTrackingOperationalSummary({
      observations: [
        makeObservation({
          id: 'arrival-ts-actual',
          type: 'ARRIVAL',
          event_time_type: 'ACTUAL',
          event_time: '2026-02-13T10:00:00.000Z',
          location_code: 'ESBCN07',
          location_display: 'Barcelona',
          created_at: '2026-02-13T10:00:00.000Z',
        }),
        makeObservation({
          id: 'arrival-pod-expected',
          type: 'ARRIVAL',
          event_time_type: 'EXPECTED',
          event_time: '2026-03-08T10:00:00.000Z',
          location_code: 'BRSSZBT',
          location_display: 'Santos',
          created_at: '2026-02-14T10:00:00.000Z',
        }),
      ],
      status: 'IN_TRANSIT',
      transshipment: {
        hasTransshipment: true,
        transshipmentCount: 1,
        ports: ['ESBCN07'],
      },
      podLocationCode: null,
      now: instantFromIsoText('2026-02-20T00:00:00.000Z'),
    })

    expect(summary.eta).not.toBeNull()
    expect(temporalCanonicalText(summary.eta?.eventTime ?? null)).toBe('2026-03-08T10:00:00.000Z')
    expect(summary.eta?.eventTimeType).toBe('EXPECTED')
    expect(summary.eta?.state).toBe('ACTIVE_EXPECTED')
    expect(summary.eta?.locationCode).toBe('BRSSZBT')
  })
})
