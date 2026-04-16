import { describe, expect, it } from 'vitest'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { reconcileForDisplay } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import {
  instantFromIsoText,
  resolveTemporalValue,
  temporalCanonicalText,
  temporalValueFromCanonical,
} from '~/shared/time/tests/helpers'

const CONTAINER_ID = '00000000-0000-0000-0000-000000000002'
const CONTAINER_NUMBER = 'CXDU2058677'
const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000001'

let idCounter = 10

type ObservationOverrides = Omit<Partial<Observation>, 'event_time'> & {
  readonly event_time?: string | Observation['event_time']
}

const DEFAULT_EVENT_TIME = temporalValueFromCanonical('2026-01-10T00:00:00.000Z')

function makeObs(overrides: ObservationOverrides = {}): Observation {
  const { event_time, ...rest } = overrides
  const id = `00000000-0000-0000-0000-0000000000${String(idCounter++).padStart(2, '0')}`
  return {
    id,
    fingerprint: `fp-${id}`,
    container_id: CONTAINER_ID,
    container_number: CONTAINER_NUMBER,
    type: 'DEPARTURE',
    event_time: resolveTemporalValue(event_time, DEFAULT_EVENT_TIME),
    event_time_type: 'EXPECTED',
    location_code: 'ESBCN',
    location_display: 'BARCELONA, ES',
    vessel_name: 'CMA CGM VOLTAIRE',
    voyage: null,
    is_empty: null,
    confidence: 'high',
    provider: 'msc',
    created_from_snapshot_id: SNAPSHOT_ID,
    created_at: '2026-01-01T00:00:00.000Z',
    ...rest,
  }
}

describe('reconcileForDisplay', () => {
  const now = instantFromIsoText('2026-02-01T00:00:00.000Z')

  describe('Case A: Multiple EXPECTED → keep only latest', () => {
    it('should collapse 3 future EXPECTED into only the most recent', () => {
      const obs = [
        makeObs({ event_time: '2026-02-05T00:00:00.000Z' }),
        makeObs({ event_time: '2026-02-10T00:00:00.000Z' }),
        makeObs({ event_time: '2026-02-15T00:00:00.000Z' }),
      ]
      const result = reconcileForDisplay(obs, now)
      expect(result).toHaveLength(1)
      expect(temporalCanonicalText(result[0]?.event_time ?? null)).toBe('2026-02-15T00:00:00.000Z')
    })

    it('should keep EXPECTED from different semantic groups independently', () => {
      const departure = makeObs({
        type: 'DEPARTURE',
        event_time: '2026-02-05T00:00:00.000Z',
      })
      const arrival = makeObs({
        type: 'ARRIVAL',
        event_time: '2026-02-10T00:00:00.000Z',
      })
      const result = reconcileForDisplay([departure, arrival], now)
      expect(result).toHaveLength(2)
    })
  })

  describe('Case B: EXPECTED then ACTUAL → hide EXPECTED', () => {
    it('should hide EXPECTED older than ACTUAL in same group', () => {
      const expected = makeObs({
        event_time: '2026-01-05T00:00:00.000Z',
        event_time_type: 'EXPECTED',
      })
      const actual = makeObs({
        event_time: '2026-01-07T00:00:00.000Z',
        event_time_type: 'ACTUAL',
      })
      const result = reconcileForDisplay([expected, actual], now)
      expect(result).toHaveLength(1)
      expect(result[0]?.event_time_type).toBe('ACTUAL')
    })

    it('should hide all EXPECTED older than ACTUAL', () => {
      const obs = [
        makeObs({ event_time: '2026-01-02T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-01-04T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-01-06T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-01-07T00:00:00.000Z', event_time_type: 'ACTUAL' }),
      ]
      const result = reconcileForDisplay(obs, now)
      expect(result).toHaveLength(1)
      expect(result[0]?.event_time_type).toBe('ACTUAL')
    })
  })

  describe('Case C: ACTUAL then future EXPECTED → keep both (new plan)', () => {
    it('should keep future EXPECTED after ACTUAL', () => {
      const actual = makeObs({
        event_time: '2026-01-07T00:00:00.000Z',
        event_time_type: 'ACTUAL',
      })
      const futureExpected = makeObs({
        event_time: '2026-02-15T00:00:00.000Z',
        event_time_type: 'EXPECTED',
      })
      const result = reconcileForDisplay([actual, futureExpected], now)
      expect(result).toHaveLength(2)
      expect(result[0]?.event_time_type).toBe('ACTUAL')
      expect(result[1]?.event_time_type).toBe('EXPECTED')
    })

    it('should keep only latest future EXPECTED after ACTUAL when multiple exist', () => {
      const actual = makeObs({
        event_time: '2026-01-07T00:00:00.000Z',
        event_time_type: 'ACTUAL',
      })
      const future1 = makeObs({
        event_time: '2026-02-10T00:00:00.000Z',
        event_time_type: 'EXPECTED',
      })
      const future2 = makeObs({
        event_time: '2026-02-20T00:00:00.000Z',
        event_time_type: 'EXPECTED',
      })
      const result = reconcileForDisplay([actual, future1, future2], now)
      expect(result).toHaveLength(2)
      expect(result[0]?.event_time_type).toBe('ACTUAL')
      expect(temporalCanonicalText(result[1]?.event_time ?? null)).toBe('2026-02-20T00:00:00.000Z')
    })
  })

  describe('Case D: Expired EXPECTED without ACTUAL → remove', () => {
    it('should remove expired EXPECTED when no ACTUAL exists', () => {
      const obs = [
        makeObs({ event_time: '2026-01-05T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-01-10T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-01-15T00:00:00.000Z', event_time_type: 'EXPECTED' }),
      ]
      // All are in the past relative to now (2026-02-01)
      const result = reconcileForDisplay(obs, now)
      expect(result).toHaveLength(0)
    })
  })

  describe('ACTUAL observations are always kept', () => {
    it('should never remove ACTUAL observations', () => {
      const obs = [
        makeObs({ event_time: '2026-01-05T00:00:00.000Z', event_time_type: 'ACTUAL' }),
        makeObs({ event_time: '2026-01-10T00:00:00.000Z', event_time_type: 'ACTUAL' }),
      ]
      const result = reconcileForDisplay(obs, now)
      expect(result).toHaveLength(2)
    })
  })

  describe('Semantic group isolation', () => {
    it('should not cross-contaminate between different locations', () => {
      const bcnExpected = makeObs({
        event_time: '2026-01-05T00:00:00.000Z',
        event_time_type: 'EXPECTED',
        location_code: 'ESBCN',
      })
      const napActual = makeObs({
        event_time: '2026-01-07T00:00:00.000Z',
        event_time_type: 'ACTUAL',
        location_code: 'ITNAP',
      })
      const result = reconcileForDisplay([bcnExpected, napActual], now)
      // BCN expected is expired (past) with no ACTUAL in same group → removed
      // NAP actual is always kept
      expect(result).toHaveLength(1)
      expect(result[0]?.location_code).toBe('ITNAP')
    })

    it('should not cross-contaminate between different vessels', () => {
      const voltaireExpected = makeObs({
        event_time: '2026-02-10T00:00:00.000Z',
        event_time_type: 'EXPECTED',
        vessel_name: 'CMA CGM VOLTAIRE',
      })
      const lisaExpected = makeObs({
        event_time: '2026-02-15T00:00:00.000Z',
        event_time_type: 'EXPECTED',
        vessel_name: 'CMA CGM LISA MARIE',
      })
      const result = reconcileForDisplay([voltaireExpected, lisaExpected], now)
      // Different vessels = different groups → both kept
      expect(result).toHaveLength(2)
    })

    it('should not cross-contaminate between different activity types', () => {
      const departure = makeObs({
        type: 'DEPARTURE',
        event_time: '2026-02-05T00:00:00.000Z',
        event_time_type: 'EXPECTED',
      })
      const arrival = makeObs({
        type: 'ARRIVAL',
        event_time: '2026-02-10T00:00:00.000Z',
        event_time_type: 'EXPECTED',
      })
      const result = reconcileForDisplay([departure, arrival], now)
      expect(result).toHaveLength(2)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty input', () => {
      const result = reconcileForDisplay([], now)
      expect(result).toHaveLength(0)
    })

    it('should handle single ACTUAL observation', () => {
      const obs = [makeObs({ event_time_type: 'ACTUAL' })]
      const result = reconcileForDisplay(obs, now)
      expect(result).toHaveLength(1)
    })

    it('should handle single future EXPECTED observation', () => {
      const obs = [makeObs({ event_time: '2026-03-01T00:00:00.000Z', event_time_type: 'EXPECTED' })]
      const result = reconcileForDisplay(obs, now)
      expect(result).toHaveLength(1)
    })

    it('should handle EXPECTED with null event_time (kept as active)', () => {
      const obs = [makeObs({ event_time: null, event_time_type: 'EXPECTED' })]
      const result = reconcileForDisplay(obs, now)
      expect(result).toHaveLength(1)
    })

    it('should not mutate the input array', () => {
      const obs = [
        makeObs({ event_time: '2026-01-05T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-01-10T00:00:00.000Z', event_time_type: 'EXPECTED' }),
      ]
      const original = [...obs]
      reconcileForDisplay(obs, now)
      expect(obs).toEqual(original)
    })

    it('should be deterministic', () => {
      const obs = [
        makeObs({ event_time: '2026-01-05T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-02-10T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-01-07T00:00:00.000Z', event_time_type: 'ACTUAL' }),
      ]
      const result1 = reconcileForDisplay(obs, now)
      const result2 = reconcileForDisplay(obs, now)
      expect(result1).toEqual(result2)
    })
  })

  describe('Real-world scenario from issue', () => {
    it('should collapse EXPECTED departure chain + ACTUAL to show only ACTUAL', () => {
      // From the issue:
      // EXPECTED departure 01/02
      // EXPECTED departure 03/02
      // EXPECTED departure 05/02
      // ACTUAL   departure 07/02
      const obs = [
        makeObs({
          type: 'DEPARTURE',
          event_time: '2026-02-01T00:00:00.000Z',
          event_time_type: 'EXPECTED',
          location_code: 'ESBCN',
          vessel_name: 'CMA CGM VOLTAIRE',
        }),
        makeObs({
          type: 'DEPARTURE',
          event_time: '2026-02-03T00:00:00.000Z',
          event_time_type: 'EXPECTED',
          location_code: 'ESBCN',
          vessel_name: 'CMA CGM VOLTAIRE',
        }),
        makeObs({
          type: 'DEPARTURE',
          event_time: '2026-02-05T00:00:00.000Z',
          event_time_type: 'EXPECTED',
          location_code: 'ESBCN',
          vessel_name: 'CMA CGM VOLTAIRE',
        }),
        makeObs({
          type: 'DEPARTURE',
          event_time: '2026-02-07T00:00:00.000Z',
          event_time_type: 'ACTUAL',
          location_code: 'ESBCN',
          vessel_name: 'CMA CGM VOLTAIRE',
        }),
      ]
      // now is 2026-02-01, so Feb 1, 3, 5 EXPECTED are <= ACTUAL Feb 7
      const result = reconcileForDisplay(obs, now)
      expect(result).toHaveLength(1)
      expect(result[0]?.event_time_type).toBe('ACTUAL')
      expect(temporalCanonicalText(result[0]?.event_time ?? null)).toBe('2026-02-07T00:00:00.000Z')
    })
  })
})
