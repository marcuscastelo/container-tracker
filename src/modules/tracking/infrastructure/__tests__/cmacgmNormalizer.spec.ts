import { describe, expect, it } from 'vitest'
import type { Snapshot } from '~/modules/tracking/domain/snapshot'
import fullPayload from '~/modules/tracking/infrastructure/__tests__/fixtures/cmacgm/cmacgm_full.json'
import { normalizeCmaCgmSnapshot } from '~/modules/tracking/infrastructure/adapters/cmacgmNormalizer'

const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000001'
const CONTAINER_ID = '00000000-0000-0000-0000-000000000002'

function makeSnapshot(payload: unknown, fetchedAt: string = '2026-02-03T12:00:00.000Z'): Snapshot {
  return {
    id: SNAPSHOT_ID,
    container_id: CONTAINER_ID,
    provider: 'cmacgm',
    fetched_at: fetchedAt,
    payload,
  }
}

describe('normalizeCmaCgmSnapshot', () => {
  describe('full payload fixture', () => {
    it('should produce observation drafts from all move arrays', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      // 9 PastMoves + 1 CurrentMove + 1 ProvisionalMove = 11
      expect(drafts).toHaveLength(11)
    })

    it('should extract container number from ContainerReference', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      for (const d of drafts) {
        expect(d.container_number).toBe('FSCU4565494')
      }
    })

    it('should map "Empty to shipper" to GATE_OUT', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const gateOut = drafts.find((d) => d.type === 'GATE_OUT' && d.location_code === 'ESZAZ')
      expect(gateOut).toBeDefined()
    })

    it('should map "Received for export transfer" to GATE_IN', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const gateIn = drafts.find((d) => d.type === 'GATE_IN' && d.location_code === 'ESZAZ')
      expect(gateIn).toBeDefined()
    })

    it('should map "Loaded on board" to LOAD with vessel info', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const load = drafts.find((d) => d.type === 'LOAD' && d.location_code === 'ESBCN')
      expect(load).toBeDefined()
      expect(load?.vessel_name).toBe('CMA CGM VOLTAIRE')
      expect(load?.voyage).toBe('0DVNTS1MA')
    })

    it('should map "Vessel Departure" to DEPARTURE', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const departures = drafts.filter((d) => d.type === 'DEPARTURE')
      expect(departures.length).toBeGreaterThanOrEqual(2)
    })

    it('should map "Vessel Arrival" to ARRIVAL', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const arrivals = drafts.filter((d) => d.type === 'ARRIVAL')
      expect(arrivals.length).toBeGreaterThanOrEqual(2)
    })

    it('should map "Discharged in transhipment" to DISCHARGE', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const discharge = drafts.find(
        (d) =>
          d.type === 'DISCHARGE' &&
          d.location_code === 'MAPTM' &&
          d.vessel_name === 'CMA CGM VOLTAIRE',
      )
      expect(discharge).toBeDefined()
    })

    it('should map "Discharged" (current move) to DISCHARGE', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const discharge = drafts.find((d) => d.type === 'DISCHARGE' && d.location_code === 'BRIGI')
      expect(discharge).toBeDefined()
    })

    it('should map "Train Departure" (provisional) to DEPARTURE', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const trainDep = drafts.find((d) => d.type === 'DEPARTURE' && d.location_code === 'ESTUD')
      expect(trainDep).toBeDefined()
      expect(trainDep?.confidence).toBe('medium') // State=NONE → provisional
    })

    it('should parse MS Date format correctly', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const first = drafts[0]
      expect(first?.event_time).toBeDefined()
      // /Date(1764659520000)/ → 2025-12-02T08:12:00.000Z
      expect(first?.event_time).toContain('2025-12-02')
    })

    it('should set provider and snapshot_id on all drafts', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      for (const d of drafts) {
        expect(d.provider).toBe('cmacgm')
        expect(d.snapshot_id).toBe(SNAPSHOT_ID)
      }
    })

    it('should NOT include vessel info for GATE_OUT events', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const gateOut = drafts.find((d) => d.type === 'GATE_OUT')
      expect(gateOut?.vessel_name).toBeNull()
      expect(gateOut?.voyage).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should return empty array for invalid payload', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(null))
      expect(drafts).toHaveLength(0)
    })

    it('should return empty array for non-object payload', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot('not an object'))
      expect(drafts).toHaveLength(0)
    })

    it('should handle payload with no moves', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot({ ContainerReference: 'TEST1234567' }))
      expect(drafts).toHaveLength(0)
    })

    it('should handle error marker payload gracefully', () => {
      const drafts = normalizeCmaCgmSnapshot(
        makeSnapshot({ _error: true, message: 'Request failed with status code 403' }),
      )
      expect(drafts).toHaveLength(0)
    })
  })
})
