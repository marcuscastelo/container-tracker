import { describe, expect, it } from 'vitest'
import type { Snapshot } from '~/modules/tracking/domain/snapshot'
import { normalizeMaerskSnapshot } from '~/modules/tracking/infrastructure/adapters/maersk.normalizer'
import fullPayload from '~/modules/tracking/infrastructure/tests/fixtures/maersk/maersk_full.json'

const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000001'
const CONTAINER_ID = '00000000-0000-0000-0000-000000000002'

function makeSnapshot(payload: unknown, fetchedAt: string = '2026-02-03T15:00:00.000Z'): Snapshot {
  return {
    id: SNAPSHOT_ID,
    container_id: CONTAINER_ID,
    provider: 'maersk',
    fetched_at: fetchedAt,
    payload,
  }
}

describe('normalizeMaerskSnapshot', () => {
  describe('full payload fixture', () => {
    it('should produce observation drafts from all events', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      // 4 events at PORT SAID EAST + 2 at TANGER MED + 1 at SANTOS = 7
      expect(drafts).toHaveLength(7)
    })

    it('should extract container number from container_num', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      for (const d of drafts) {
        expect(d.container_number).toBe('MNBU3094033')
      }
    })

    it('should map "GATE-OUT" to GATE_OUT with empty flag', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      const gateOut = drafts.find((d) => d.type === 'GATE_OUT')
      expect(gateOut).toBeDefined()
      expect(gateOut?.is_empty).toBe(true)
      expect(gateOut?.location_code).toBe('EGPSDTM')
    })

    it('should map "GATE-IN" to GATE_IN', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      const gateIn = drafts.find((d) => d.type === 'GATE_IN')
      expect(gateIn).toBeDefined()
      expect(gateIn?.is_empty).toBe(false)
    })

    it('should map "LOAD" with vessel info', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      const load = drafts.find((d) => d.type === 'LOAD')
      expect(load).toBeDefined()
      expect(load?.vessel_name).toBe('MAERSK BROWNSVILLE')
      expect(load?.voyage).toBe('603S')
      expect(load?.location_code).toBe('EGPSDTM')
    })

    it('should map "CONTAINER DEPARTURE" to DEPARTURE', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      const departures = drafts.filter((d) => d.type === 'DEPARTURE')
      expect(departures.length).toBeGreaterThanOrEqual(1)
      const dep = departures[0]
      expect(dep?.vessel_name).toBe('MAERSK BROWNSVILLE')
    })

    it('should map "CONTAINER ARRIVAL" to ARRIVAL', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      const arrivals = drafts.filter((d) => d.type === 'ARRIVAL')
      expect(arrivals.length).toBeGreaterThanOrEqual(1)
    })

    it('should derive location_display from location city and country_code', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      const gateOut = drafts.find((d) => d.type === 'GATE_OUT')
      expect(gateOut?.location_display).toBe('PORT SAID EAST, EG')
    })

    it('should set EXPECTED events with medium confidence', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      // Last events at TANGER MED and SANTOS have event_time_type=EXPECTED
      const expected = drafts.filter((d) => d.confidence === 'medium')
      expect(expected.length).toBeGreaterThanOrEqual(1)
    })

    it('should set ACTUAL events with high confidence', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      const actual = drafts.filter((d) => d.confidence === 'high')
      expect(actual.length).toBeGreaterThanOrEqual(3)
    })

    it('should set provider and snapshot_id on all drafts', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      for (const d of drafts) {
        expect(d.provider).toBe('maersk')
        expect(d.snapshot_id).toBe(SNAPSHOT_ID)
      }
    })

    it('should NOT include vessel info for GATE_IN/GATE_OUT events', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      const gateIn = drafts.find((d) => d.type === 'GATE_IN')
      expect(gateIn?.vessel_name).toBeNull()
      expect(gateIn?.voyage).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should return empty array for invalid payload', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(null))
      expect(drafts).toHaveLength(0)
    })

    it('should return empty array for non-object payload', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot('not an object'))
      expect(drafts).toHaveLength(0)
    })

    it('should handle payload with no containers', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot({ origin: {}, destination: {} }))
      expect(drafts).toHaveLength(0)
    })

    it('should handle error marker payload gracefully', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot({ _error: true, message: 'timeout' }))
      expect(drafts).toHaveLength(0)
    })
  })
})
