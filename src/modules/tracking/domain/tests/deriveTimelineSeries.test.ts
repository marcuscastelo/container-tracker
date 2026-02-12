import { describe, expect, it } from 'vitest'
import { deriveTimelineSeries } from '~/modules/tracking/domain/deriveTimeline'
import type { Observation } from '~/modules/tracking/domain/observation'

const CONTAINER_ID = '00000000-0000-0000-0000-000000000002'
const CONTAINER_NUMBER = 'CXDU2058677'
const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000001'

let idCounter = 10

function makeObs(overrides: Partial<Observation> = {}): Observation {
  const id = `00000000-0000-0000-0000-0000000000${String(idCounter++).padStart(2, '0')}`
  return {
    id,
    fingerprint: `fp-${id}`,
    container_id: CONTAINER_ID,
    container_number: CONTAINER_NUMBER,
    type: 'DEPARTURE',
    event_time: '2026-02-10T00:00:00.000Z',
    event_time_type: 'EXPECTED',
    location_code: 'ESBCN',
    location_display: 'BARCELONA, ES',
    vessel_name: 'CMA CGM VOLTAIRE',
    voyage: 'ABC123',
    is_empty: null,
    confidence: 'high',
    provider: 'msc',
    created_from_snapshot_id: SNAPSHOT_ID,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('deriveTimelineSeries', () => {
  const now = new Date('2026-02-01T00:00:00.000Z')

  describe('Case A: Multiple EXPECTED → collapse to latest', () => {
    it('should show only the latest EXPECTED when multiple exist', () => {
      const obs = [
        makeObs({ event_time: '2026-02-05T00:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z' }),
        makeObs({ event_time: '2026-02-10T00:00:00.000Z', created_at: '2026-01-02T00:00:00.000Z' }),
        makeObs({ event_time: '2026-02-15T00:00:00.000Z', created_at: '2026-01-03T00:00:00.000Z' }),
      ]
      const result = deriveTimelineSeries(obs, now)

      expect(result).toHaveLength(1)
      expect(result[0]?.kind).toBe('event')
      if (result[0]?.kind === 'event') {
        expect(result[0].primary.event_time).toBe('2026-02-15T00:00:00.000Z')
        expect(result[0].series).toHaveLength(3)
        expect(result[0].series?.[0]?.event_time).toBe('2026-02-05T00:00:00.000Z')
        expect(result[0].series?.[1]?.event_time).toBe('2026-02-10T00:00:00.000Z')
        expect(result[0].series?.[2]?.event_time).toBe('2026-02-15T00:00:00.000Z')
      }
    })

    it('should keep EXPECTED from different semantic groups separate', () => {
      const departure = makeObs({
        type: 'DEPARTURE',
        event_time: '2026-02-05T00:00:00.000Z',
      })
      const arrival = makeObs({
        type: 'ARRIVAL',
        event_time: '2026-02-10T00:00:00.000Z',
      })
      const result = deriveTimelineSeries([departure, arrival], now)

      expect(result).toHaveLength(2)
      expect(result[0]?.kind).toBe('event')
      expect(result[1]?.kind).toBe('event')
      if (result[0]?.kind === 'event' && result[1]?.kind === 'event') {
        expect(result[0].primary.type).toBe('DEPARTURE')
        expect(result[1].primary.type).toBe('ARRIVAL')
      }
    })

    it('should not attach series when only one observation exists', () => {
      const obs = [makeObs({ event_time: '2026-02-15T00:00:00.000Z' })]
      const result = deriveTimelineSeries(obs, now)

      expect(result).toHaveLength(1)
      if (result[0]?.kind === 'event') {
        expect(result[0].series).toBeUndefined()
      }
    })
  })

  describe('Case B: EXPECTED → ACTUAL → collapse to ACTUAL', () => {
    it('should show ACTUAL as primary when it exists', () => {
      const expected = makeObs({
        event_time: '2026-02-05T00:00:00.000Z',
        event_time_type: 'EXPECTED',
      })
      const actual = makeObs({
        event_time: '2026-02-07T00:00:00.000Z',
        event_time_type: 'ACTUAL',
      })
      const result = deriveTimelineSeries([expected, actual], now)

      expect(result).toHaveLength(1)
      if (result[0]?.kind === 'event') {
        expect(result[0].primary.event_time_type).toBe('ACTUAL')
        expect(result[0].primary.event_time).toBe('2026-02-07T00:00:00.000Z')
        expect(result[0].series).toHaveLength(2)
      }
    })

    it('should include all EXPECTED in series when ACTUAL exists', () => {
      const obs = [
        makeObs({ event_time: '2026-02-01T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-02-03T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-02-05T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-02-07T00:00:00.000Z', event_time_type: 'ACTUAL' }),
      ]
      const result = deriveTimelineSeries(obs, now)

      expect(result).toHaveLength(1)
      if (result[0]?.kind === 'event') {
        expect(result[0].primary.event_time_type).toBe('ACTUAL')
        expect(result[0].series).toHaveLength(4)
      }
    })

    it('should use most recent ACTUAL when multiple exist', () => {
      const obs = [
        makeObs({ event_time: '2026-02-05T00:00:00.000Z', event_time_type: 'ACTUAL' }),
        makeObs({ event_time: '2026-02-10T00:00:00.000Z', event_time_type: 'ACTUAL' }),
      ]
      const result = deriveTimelineSeries(obs, now)

      expect(result).toHaveLength(1)
      if (result[0]?.kind === 'event') {
        expect(result[0].primary.event_time).toBe('2026-02-10T00:00:00.000Z')
        expect(result[0].series).toHaveLength(2)
      }
    })
  })

  describe('Case C: ACTUAL → future EXPECTED → keep both as separate series', () => {
    it('should keep ACTUAL and future EXPECTED as different series when voyage differs', () => {
      const actual = makeObs({
        event_time: '2026-01-07T00:00:00.000Z',
        event_time_type: 'ACTUAL',
        voyage: 'VOY001',
      })
      const futureExpected = makeObs({
        event_time: '2026-02-15T00:00:00.000Z',
        event_time_type: 'EXPECTED',
        voyage: 'VOY002',
      })
      const result = deriveTimelineSeries([actual, futureExpected], now)

      expect(result).toHaveLength(2)
      if (result[0]?.kind === 'event' && result[1]?.kind === 'event') {
        expect(result[0].primary.event_time_type).toBe('ACTUAL')
        expect(result[1].primary.event_time_type).toBe('EXPECTED')
      }
    })

    it('should keep both when same voyage but different vessel', () => {
      const actual = makeObs({
        event_time: '2026-01-07T00:00:00.000Z',
        event_time_type: 'ACTUAL',
        vessel_name: 'VESSEL A',
      })
      const futureExpected = makeObs({
        event_time: '2026-02-15T00:00:00.000Z',
        event_time_type: 'EXPECTED',
        vessel_name: 'VESSEL B',
      })
      const result = deriveTimelineSeries([actual, futureExpected], now)

      expect(result).toHaveLength(2)
    })
  })

  describe('Case D: Different vessel/voyage same activity → different series', () => {
    it('should keep observations with different vessels as separate series', () => {
      const voltaire = makeObs({
        event_time: '2026-02-10T00:00:00.000Z',
        vessel_name: 'CMA CGM VOLTAIRE',
      })
      const lisa = makeObs({
        event_time: '2026-02-15T00:00:00.000Z',
        vessel_name: 'CMA CGM LISA MARIE',
      })
      const result = deriveTimelineSeries([voltaire, lisa], now)

      expect(result).toHaveLength(2)
    })

    it('should keep observations with different voyages as separate series', () => {
      const voy1 = makeObs({
        event_time: '2026-02-10T00:00:00.000Z',
        voyage: 'VOY001',
      })
      const voy2 = makeObs({
        event_time: '2026-02-15T00:00:00.000Z',
        voyage: 'VOY002',
      })
      const result = deriveTimelineSeries([voy1, voy2], now)

      expect(result).toHaveLength(2)
    })

    it('should keep observations with different locations as separate series', () => {
      const bcn = makeObs({
        event_time: '2026-02-10T00:00:00.000Z',
        location_code: 'ESBCN',
      })
      const nap = makeObs({
        event_time: '2026-02-15T00:00:00.000Z',
        location_code: 'ITNAP',
      })
      const result = deriveTimelineSeries([bcn, nap], now)

      expect(result).toHaveLength(2)
    })
  })

  describe('Expired EXPECTED handling', () => {
    it('should not show expired EXPECTED as primary when no ACTUAL exists', () => {
      const obs = [
        makeObs({ event_time: '2026-01-05T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-01-10T00:00:00.000Z', event_time_type: 'EXPECTED' }),
      ]
      // Both are in the past relative to now (2026-02-01)
      const result = deriveTimelineSeries(obs, now)

      expect(result).toHaveLength(0)
    })

    it('should include expired EXPECTED in series when ACTUAL exists', () => {
      const obs = [
        makeObs({ event_time: '2026-01-05T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-02-07T00:00:00.000Z', event_time_type: 'ACTUAL' }),
      ]
      const result = deriveTimelineSeries(obs, now)

      expect(result).toHaveLength(1)
      if (result[0]?.kind === 'event') {
        expect(result[0].primary.event_time_type).toBe('ACTUAL')
        expect(result[0].series).toHaveLength(2)
      }
    })

    it('should show active EXPECTED when mixed with expired ones', () => {
      const obs = [
        makeObs({ event_time: '2026-01-05T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-01-10T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-02-15T00:00:00.000Z', event_time_type: 'EXPECTED' }),
      ]
      const result = deriveTimelineSeries(obs, now)

      expect(result).toHaveLength(1)
      if (result[0]?.kind === 'event') {
        expect(result[0].primary.event_time).toBe('2026-02-15T00:00:00.000Z')
        expect(result[0].series).toHaveLength(3)
      }
    })
  })

  describe('Series key edge cases', () => {
    it('should use location_display when location_code is null', () => {
      const obs1 = makeObs({
        location_code: null,
        location_display: 'Barcelona, ES',
        event_time: '2026-02-05T00:00:00.000Z',
      })
      const obs2 = makeObs({
        location_code: null,
        location_display: 'barcelona, es', // different case
        event_time: '2026-02-10T00:00:00.000Z',
      })
      const result = deriveTimelineSeries([obs1, obs2], now)

      // Should be grouped together (normalized to same case)
      expect(result).toHaveLength(1)
      if (result[0]?.kind === 'event') {
        expect(result[0].series).toHaveLength(2)
      }
    })

    it('should handle null vessel_name', () => {
      const obs = [
        makeObs({ vessel_name: null, event_time: '2026-02-05T00:00:00.000Z' }),
        makeObs({ vessel_name: null, event_time: '2026-02-10T00:00:00.000Z' }),
      ]
      const result = deriveTimelineSeries(obs, now)

      expect(result).toHaveLength(1)
      if (result[0]?.kind === 'event') {
        expect(result[0].series).toHaveLength(2)
      }
    })

    it('should handle null voyage', () => {
      const obs = [
        makeObs({ voyage: null, event_time: '2026-02-05T00:00:00.000Z' }),
        makeObs({ voyage: null, event_time: '2026-02-10T00:00:00.000Z' }),
      ]
      const result = deriveTimelineSeries(obs, now)

      expect(result).toHaveLength(1)
      if (result[0]?.kind === 'event') {
        expect(result[0].series).toHaveLength(2)
      }
    })

    it('should handle null event_time as active', () => {
      const obs = [
        makeObs({ event_time: null, event_time_type: 'EXPECTED' }),
      ]
      const result = deriveTimelineSeries(obs, now)

      expect(result).toHaveLength(1)
      if (result[0]?.kind === 'event') {
        expect(result[0].primary.event_time).toBeNull()
      }
    })
  })

  describe('Chronological ordering', () => {
    it('should sort results chronologically by primary event_time', () => {
      const obs = [
        makeObs({
          type: 'DEPARTURE',
          event_time: '2026-02-15T00:00:00.000Z',
          location_code: 'ESBCN',
        }),
        makeObs({
          type: 'ARRIVAL',
          event_time: '2026-02-05T00:00:00.000Z',
          location_code: 'ITNAP',
        }),
        makeObs({
          type: 'LOAD',
          event_time: '2026-02-10T00:00:00.000Z',
          location_code: 'FRPAR',
        }),
      ]
      const result = deriveTimelineSeries(obs, now)

      expect(result).toHaveLength(3)
      if (
        result[0]?.kind === 'event' &&
        result[1]?.kind === 'event' &&
        result[2]?.kind === 'event'
      ) {
        expect(result[0].primary.event_time).toBe('2026-02-05T00:00:00.000Z')
        expect(result[1].primary.event_time).toBe('2026-02-10T00:00:00.000Z')
        expect(result[2].primary.event_time).toBe('2026-02-15T00:00:00.000Z')
      }
    })

    it('should place ACTUAL before EXPECTED when event_time is equal', () => {
      const obs = [
        makeObs({
          event_time: '2026-02-10T00:00:00.000Z',
          event_time_type: 'EXPECTED',
          vessel_name: 'VESSEL A',
        }),
        makeObs({
          event_time: '2026-02-10T00:00:00.000Z',
          event_time_type: 'ACTUAL',
          vessel_name: 'VESSEL B',
        }),
      ]
      const result = deriveTimelineSeries(obs, now)

      expect(result).toHaveLength(2)
      if (result[0]?.kind === 'event' && result[1]?.kind === 'event') {
        expect(result[0].primary.event_time_type).toBe('ACTUAL')
        expect(result[1].primary.event_time_type).toBe('EXPECTED')
      }
    })

    it('should use created_at as tiebreaker when event_time is null', () => {
      const obs = [
        makeObs({
          event_time: null,
          created_at: '2026-01-10T00:00:00.000Z',
          vessel_name: 'VESSEL A',
        }),
        makeObs({
          event_time: null,
          created_at: '2026-01-05T00:00:00.000Z',
          vessel_name: 'VESSEL B',
        }),
      ]
      const result = deriveTimelineSeries(obs, now)

      expect(result).toHaveLength(2)
      if (result[0]?.kind === 'event' && result[1]?.kind === 'event') {
        expect(result[0].primary.created_at).toBe('2026-01-05T00:00:00.000Z')
        expect(result[1].primary.created_at).toBe('2026-01-10T00:00:00.000Z')
      }
    })
  })

  describe('Real-world scenario from issue', () => {
    it('should collapse EXPECTED departure chain with prediction history', () => {
      // Real scenario: CMA frequently updates departure ETAs
      // EXPECTED departure 12/02
      // EXPECTED departure 13/02
      const obs = [
        makeObs({
          type: 'DEPARTURE',
          event_time: '2026-02-12T00:00:00.000Z',
          event_time_type: 'EXPECTED',
          location_code: 'ESBCN',
          vessel_name: 'CMA CGM VOLTAIRE',
          voyage: 'VOY123',
          created_at: '2026-02-01T08:00:00.000Z',
        }),
        makeObs({
          type: 'DEPARTURE',
          event_time: '2026-02-13T00:00:00.000Z',
          event_time_type: 'EXPECTED',
          location_code: 'ESBCN',
          vessel_name: 'CMA CGM VOLTAIRE',
          voyage: 'VOY123',
          created_at: '2026-02-01T14:00:00.000Z',
        }),
      ]
      const result = deriveTimelineSeries(obs, now)

      // Should show only one timeline entry (latest EXPECTED)
      expect(result).toHaveLength(1)
      if (result[0]?.kind === 'event') {
        expect(result[0].primary.event_time).toBe('2026-02-13T00:00:00.000Z')
        // Series should contain both for ⓘ history
        expect(result[0].series).toHaveLength(2)
        expect(result[0].series?.[0]?.event_time).toBe('2026-02-12T00:00:00.000Z')
        expect(result[0].series?.[1]?.event_time).toBe('2026-02-13T00:00:00.000Z')
      }
    })
  })
})
