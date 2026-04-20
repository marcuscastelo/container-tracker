import { describe, expect, it } from 'vitest'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import {
  deriveObservationState,
  isExpiredExpected,
} from '~/modules/tracking/features/series/domain/reconcile/expiredExpected'
import { CalendarDate } from '~/shared/time/calendar-date'
import { calendarDateValue } from '~/shared/time/temporal-value'
import {
  instantFromIsoText,
  resolveTemporalValue,
  temporalValueFromCanonical,
} from '~/shared/time/tests/helpers'

const CONTAINER_ID = '00000000-0000-0000-0000-000000000002'
const CONTAINER_NUMBER = 'TEST-CONTAINER-123'
const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000001'

type ObservationOverrides = Omit<Partial<Observation>, 'event_time'> & {
  readonly event_time?: string | Observation['event_time']
}

const DEFAULT_EVENT_TIME = temporalValueFromCanonical('2025-11-17T00:00:00.000Z')

function makeObs(overrides: ObservationOverrides = {}): Observation {
  const { event_time, ...rest } = overrides

  return {
    id: '00000000-0000-0000-0000-000000000010',
    fingerprint: 'test-fingerprint',
    container_id: CONTAINER_ID,
    container_number: CONTAINER_NUMBER,
    type: 'OTHER',
    event_time: resolveTemporalValue(event_time, DEFAULT_EVENT_TIME),
    event_time_type: 'ACTUAL',
    location_code: 'ITNAP',
    location_display: 'NAPLES, IT',
    vessel_name: null,
    voyage: null,
    is_empty: null,
    confidence: 'high',
    provider: 'msc',
    created_from_snapshot_id: SNAPSHOT_ID,
    created_at: '2025-11-17T00:00:00.000Z',
    ...rest,
  }
}

describe('isExpiredExpected', () => {
  const now = instantFromIsoText('2026-01-15T00:00:00.000Z')

  describe('Case A: EXPECTED in future → not expired', () => {
    it('should return false for EXPECTED event in the future', () => {
      const obs = makeObs({
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        type: 'ARRIVAL',
        event_time: '2026-02-01T00:00:00.000Z',
        event_time_type: 'EXPECTED',
      })
      expect(isExpiredExpected(obs, [obs], now)).toBe(false)
    })
  })

  describe('Case B: EXPECTED in past, no ACTUAL → expired', () => {
    it('should return true for EXPECTED event in the past with no ACTUAL equivalent', () => {
      const obs = makeObs({
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        type: 'DEPARTURE',
        event_time: '2025-12-01T00:00:00.000Z',
        event_time_type: 'EXPECTED',
        location_code: 'ESBCN',
      })
      expect(isExpiredExpected(obs, [obs], now)).toBe(true)
    })

    it('should return true when ACTUAL exists but for a different type', () => {
      const expected = makeObs({
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        type: 'DEPARTURE',
        event_time: '2025-12-01T00:00:00.000Z',
        event_time_type: 'EXPECTED',
        location_code: 'ESBCN',
      })
      const actual = makeObs({
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        type: 'ARRIVAL',
        event_time: '2025-12-05T00:00:00.000Z',
        event_time_type: 'ACTUAL',
        location_code: 'ESBCN',
      })
      expect(isExpiredExpected(expected, [expected, actual], now)).toBe(true)
    })

    it('should return true when ACTUAL exists but for a different location', () => {
      const expected = makeObs({
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        type: 'ARRIVAL',
        event_time: '2025-12-01T00:00:00.000Z',
        event_time_type: 'EXPECTED',
        location_code: 'ESBCN',
      })
      const actual = makeObs({
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        type: 'ARRIVAL',
        event_time: '2025-12-05T00:00:00.000Z',
        event_time_type: 'ACTUAL',
        location_code: 'ITNAP',
      })
      expect(isExpiredExpected(expected, [expected, actual], now)).toBe(true)
    })

    it('should not expire DATE_ONLY observations before the operational day ends in the event timezone', () => {
      const obs = makeObs({
        id: '00000000-0000-0000-0000-000000000014',
        fingerprint: 'fp-date-only-sao-paulo',
        type: 'ARRIVAL',
        event_time: calendarDateValue(CalendarDate.fromIsoDate('2026-01-14'), 'America/Sao_Paulo'),
        event_time_type: 'EXPECTED',
        location_code: 'BRSSZ',
      })

      expect(isExpiredExpected(obs, [obs], now)).toBe(false)
    })

    it('should compare LOCAL_DATETIME observations using the event timezone instant', () => {
      const obs = makeObs({
        id: '00000000-0000-0000-0000-000000000015',
        fingerprint: 'fp-local-datetime-sao-paulo',
        type: 'ARRIVAL',
        event_time: '2026-01-14T22:30:00.000[America/Sao_Paulo]',
        event_time_type: 'EXPECTED',
        location_code: 'BRSSZ',
      })

      expect(isExpiredExpected(obs, [obs], now)).toBe(false)
    })
  })

  describe('Case C: EXPECTED in past, ACTUAL later → not expired', () => {
    it('should return false when matching ACTUAL exists for same type and location', () => {
      const expected = makeObs({
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        type: 'ARRIVAL',
        event_time: '2025-12-01T00:00:00.000Z',
        event_time_type: 'EXPECTED',
        location_code: 'ESBCN',
      })
      const actual = makeObs({
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        type: 'ARRIVAL',
        event_time: '2025-12-03T00:00:00.000Z',
        event_time_type: 'ACTUAL',
        location_code: 'ESBCN',
      })
      expect(isExpiredExpected(expected, [expected, actual], now)).toBe(false)
    })

    it('should return false when ACTUAL equivalent exists with null locations', () => {
      const expected = makeObs({
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        type: 'DEPARTURE',
        event_time: '2025-12-01T00:00:00.000Z',
        event_time_type: 'EXPECTED',
        location_code: null,
      })
      const actual = makeObs({
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        type: 'DEPARTURE',
        event_time: '2025-12-02T00:00:00.000Z',
        event_time_type: 'ACTUAL',
        location_code: null,
      })
      expect(isExpiredExpected(expected, [expected, actual], now)).toBe(false)
    })
  })

  describe('Edge cases', () => {
    it('should return false for ACTUAL observations', () => {
      const obs = makeObs({
        type: 'ARRIVAL',
        event_time: '2025-12-01T00:00:00.000Z',
        event_time_type: 'ACTUAL',
      })
      expect(isExpiredExpected(obs, [obs], now)).toBe(false)
    })

    it('should return false for EXPECTED with null event_time', () => {
      const obs = makeObs({
        type: 'ARRIVAL',
        event_time: null,
        event_time_type: 'EXPECTED',
      })
      expect(isExpiredExpected(obs, [obs], now)).toBe(false)
    })

    it('should return false for EXPECTED at exactly now', () => {
      const obs = makeObs({
        type: 'ARRIVAL',
        event_time: '2026-01-15T00:00:00.000Z',
        event_time_type: 'EXPECTED',
      })
      expect(isExpiredExpected(obs, [obs], now)).toBe(false)
    })

    it('should handle vessel_name matching for equivalence', () => {
      const expected = makeObs({
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        type: 'LOAD',
        event_time: '2025-12-01T00:00:00.000Z',
        event_time_type: 'EXPECTED',
        location_code: 'ESBCN',
        vessel_name: 'CMA CGM VOLTAIRE',
      })
      const actualDifferentVessel = makeObs({
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        type: 'LOAD',
        event_time: '2025-12-03T00:00:00.000Z',
        event_time_type: 'ACTUAL',
        location_code: 'ESBCN',
        vessel_name: 'CMA CGM LISA MARIE',
      })
      // Different vessel = not equivalent, so expired
      expect(isExpiredExpected(expected, [expected, actualDifferentVessel], now)).toBe(true)

      const actualSameVessel = makeObs({
        id: '00000000-0000-0000-0000-000000000013',
        fingerprint: 'fp3',
        type: 'LOAD',
        event_time: '2025-12-03T00:00:00.000Z',
        event_time_type: 'ACTUAL',
        location_code: 'ESBCN',
        vessel_name: 'CMA CGM VOLTAIRE',
      })
      // Same vessel = equivalent, so not expired
      expect(isExpiredExpected(expected, [expected, actualSameVessel], now)).toBe(false)
    })
  })
})

describe('deriveObservationState', () => {
  const now = instantFromIsoText('2026-01-15T00:00:00.000Z')

  it('should return ACTUAL for ACTUAL observations', () => {
    const obs = makeObs({ event_time_type: 'ACTUAL' })
    expect(deriveObservationState(obs, [obs], now)).toBe('ACTUAL')
  })

  it('should return ACTIVE_EXPECTED for future EXPECTED', () => {
    const obs = makeObs({
      event_time: '2026-02-01T00:00:00.000Z',
      event_time_type: 'EXPECTED',
    })
    expect(deriveObservationState(obs, [obs], now)).toBe('ACTIVE_EXPECTED')
  })

  it('should return EXPIRED_EXPECTED for past EXPECTED with no ACTUAL', () => {
    const obs = makeObs({
      type: 'DEPARTURE',
      event_time: '2025-12-01T00:00:00.000Z',
      event_time_type: 'EXPECTED',
    })
    expect(deriveObservationState(obs, [obs], now)).toBe('EXPIRED_EXPECTED')
  })

  it('should return ACTIVE_EXPECTED for past EXPECTED with matching ACTUAL', () => {
    const expected = makeObs({
      id: '00000000-0000-0000-0000-000000000011',
      fingerprint: 'fp1',
      type: 'ARRIVAL',
      event_time: '2025-12-01T00:00:00.000Z',
      event_time_type: 'EXPECTED',
      location_code: 'ESBCN',
    })
    const actual = makeObs({
      id: '00000000-0000-0000-0000-000000000012',
      fingerprint: 'fp2',
      type: 'ARRIVAL',
      event_time: '2025-12-03T00:00:00.000Z',
      event_time_type: 'ACTUAL',
      location_code: 'ESBCN',
    })
    expect(deriveObservationState(expected, [expected, actual], now)).toBe('ACTIVE_EXPECTED')
  })
})
