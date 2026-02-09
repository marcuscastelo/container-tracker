import { describe, expect, it } from 'vitest'
import type { Snapshot } from '~/modules/tracking/domain/snapshot'
import { normalizeMscSnapshot } from '~/modules/tracking/infrastructure/adapters/mscNormalizer'
import delivered from '../../../../../test/fixtures/msc/msc_delivered.json'
import dischargePod from '../../../../../test/fixtures/msc/msc_discharge_pod.json'
import initialLoad from '../../../../../test/fixtures/msc/msc_initial_load.json'
import transshipment from '../../../../../test/fixtures/msc/msc_transshipment.json'

const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000001'
const CONTAINER_ID = '00000000-0000-0000-0000-000000000002'

function makeSnapshot(payload: unknown, fetchedAt: string = '2025-11-17T00:00:00.000Z'): Snapshot {
  return {
    id: SNAPSHOT_ID,
    container_id: CONTAINER_ID,
    provider: 'msc',
    fetched_at: fetchedAt,
    payload,
  }
}

describe('normalizeMscSnapshot', () => {
  describe('initial load fixture', () => {
    it('should produce 2 observation drafts', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(initialLoad))
      expect(drafts).toHaveLength(2)
    })

    it('should map "Export received at CY" to GATE_IN', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(initialLoad))
      const gateIn = drafts.find((d) => d.type === 'GATE_IN')
      expect(gateIn).toBeDefined()
      expect(gateIn?.container_number).toBe('CXDU2058677')
      expect(gateIn?.location_code).toBe('ITNAP')
      expect(gateIn?.location_display).toBe('NAPLES, IT')
    })

    it('should map "Empty to Shipper" to GATE_OUT', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(initialLoad))
      const gateOut = drafts.find((d) => d.type === 'GATE_OUT')
      expect(gateOut).toBeDefined()
      expect(gateOut?.is_empty).toBe(true)
    })

    it('should set provider and snapshot_id on all drafts', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(initialLoad))
      for (const d of drafts) {
        expect(d.provider).toBe('msc')
        expect(d.snapshot_id).toBe(SNAPSHOT_ID)
      }
    })
  })

  describe('transshipment fixture', () => {
    it('should produce 5 observation drafts', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(transshipment))
      expect(drafts).toHaveLength(5)
    })

    it('should map "Export Loaded on Vessel" to LOAD', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(transshipment))
      const loads = drafts.filter((d) => d.type === 'LOAD')
      expect(loads.length).toBeGreaterThanOrEqual(2)
    })

    it('should map "Full Transshipment Discharged" to DISCHARGE', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(transshipment))
      const discharges = drafts.filter((d) => d.type === 'DISCHARGE')
      expect(discharges.length).toBeGreaterThanOrEqual(1)
    })

    it('should include vessel info for LOAD events', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(transshipment))
      const load = drafts.find((d) => d.type === 'LOAD' && d.location_code === 'ITNAP')
      expect(load?.vessel_name).toBe('MSC PARIS')
      expect(load?.voyage).toBe('MZ546A')
    })

    it('should NOT include vessel info for GATE_IN/GATE_OUT events', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(transshipment))
      const gateIn = drafts.find((d) => d.type === 'GATE_IN')
      expect(gateIn?.vessel_name).toBeNull()
      expect(gateIn?.voyage).toBeNull()
    })
  })

  describe('discharge at POD fixture', () => {
    it('should produce 8 observation drafts', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(dischargePod))
      expect(drafts).toHaveLength(8)
    })

    it('should have discharge at BRIOA (Itapoá)', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(dischargePod))
      const discharge = drafts.find((d) => d.type === 'DISCHARGE' && d.location_code === 'BRIOA')
      expect(discharge).toBeDefined()
      expect(discharge?.vessel_name).toBe('MSC BIANCA')
    })
  })

  describe('delivered fixture', () => {
    it('should produce 9 observation drafts', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(delivered))
      expect(drafts).toHaveLength(9)
    })

    it('should have a DELIVERY observation', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(delivered))
      const delivery = drafts.find((d) => d.type === 'DELIVERY')
      expect(delivery).toBeDefined()
      expect(delivery?.location_code).toBe('BRIOA')
    })
  })

  describe('invalid payload', () => {
    it('should return empty array for non-MSC payload', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot({ random: 'data' }))
      expect(drafts).toEqual([])
    })

    it('should return empty array for null payload', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(null))
      expect(drafts).toEqual([])
    })
  })
})
