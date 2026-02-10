import { describe, expect, it } from 'vitest'
import { deriveAlerts, deriveTransshipment } from '~/modules/tracking/domain/deriveAlerts'
import { deriveTimeline } from '~/modules/tracking/domain/deriveTimeline'
import type { Observation } from '~/modules/tracking/domain/observation'

const CONTAINER_ID = '00000000-0000-0000-0000-000000000002'
const CONTAINER_NUMBER = 'CXDU2058677'
const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000001'

function makeObs(overrides: Partial<Observation> = {}): Observation {
  return {
    id: '00000000-0000-0000-0000-000000000010',
    fingerprint: 'test-fingerprint',
    container_id: CONTAINER_ID,
    container_number: CONTAINER_NUMBER,
    type: 'OTHER',
    event_time: '2025-11-17T00:00:00.000Z',
    event_time_type: 'ACTUAL', // Default to ACTUAL for tests (confirmed events)
    location_code: 'ITNAP',
    location_display: 'NAPLES, IT',
    vessel_name: null,
    voyage: null,
    is_empty: null,
    confidence: 'high',
    provider: 'msc',
    created_from_snapshot_id: SNAPSHOT_ID,
    created_at: '2025-11-17T00:00:00.000Z',
    ...overrides,
  }
}

describe('deriveTransshipment', () => {
  it('should return no transshipment for direct route (2 ports)', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'LOAD',
        location_code: 'ITNAP',
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
      }),
      makeObs({
        type: 'DISCHARGE',
        location_code: 'BRIOA',
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2026-02-02T00:00:00.000Z',
      }),
    ])
    const result = deriveTransshipment(timeline)
    expect(result.hasTransshipment).toBe(false)
    expect(result.transshipmentCount).toBe(0)
    expect(result.ports).toHaveLength(2)
  })

  it('should detect transshipment when > 2 ports involved', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'LOAD',
        location_code: 'ITNAP',
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
      }),
      makeObs({
        type: 'DISCHARGE',
        location_code: 'ITLIV',
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2025-11-29T00:00:00.000Z',
      }),
      makeObs({
        type: 'LOAD',
        location_code: 'ITLIV',
        id: '00000000-0000-0000-0000-000000000013',
        fingerprint: 'fp3',
        event_time: '2025-11-30T00:00:00.000Z',
      }),
      makeObs({
        type: 'DISCHARGE',
        location_code: 'BRSSZ',
        id: '00000000-0000-0000-0000-000000000014',
        fingerprint: 'fp4',
        event_time: '2026-01-07T00:00:00.000Z',
      }),
      makeObs({
        type: 'LOAD',
        location_code: 'BRSSZ',
        id: '00000000-0000-0000-0000-000000000015',
        fingerprint: 'fp5',
        event_time: '2026-01-20T00:00:00.000Z',
      }),
      makeObs({
        type: 'DISCHARGE',
        location_code: 'BRIOA',
        id: '00000000-0000-0000-0000-000000000016',
        fingerprint: 'fp6',
        event_time: '2026-02-02T00:00:00.000Z',
      }),
    ])
    const result = deriveTransshipment(timeline)
    expect(result.hasTransshipment).toBe(true)
    expect(result.transshipmentCount).toBe(2) // ITLIV + BRSSZ are intermediate
    expect(result.ports).toContain('ITNAP')
    expect(result.ports).toContain('ITLIV')
    expect(result.ports).toContain('BRSSZ')
    expect(result.ports).toContain('BRIOA')
  })

  it('should ignore events without location_code', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'LOAD',
        location_code: null,
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
      }),
      makeObs({
        type: 'DISCHARGE',
        location_code: 'BRIOA',
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2026-02-02T00:00:00.000Z',
      }),
    ])
    const result = deriveTransshipment(timeline)
    expect(result.hasTransshipment).toBe(false)
    expect(result.ports).toHaveLength(1)
  })
})

describe('deriveAlerts', () => {
  describe('TRANSSHIPMENT alert (fact-based)', () => {
    it('should create a TRANSSHIPMENT alert when transshipment is detected', () => {
      const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
        makeObs({
          type: 'LOAD',
          location_code: 'ITNAP',
          id: '00000000-0000-0000-0000-000000000011',
          fingerprint: 'fp1',
        }),
        makeObs({
          type: 'DISCHARGE',
          location_code: 'ITLIV',
          id: '00000000-0000-0000-0000-000000000012',
          fingerprint: 'fp2',
          event_time: '2025-11-29T00:00:00.000Z',
        }),
        makeObs({
          type: 'LOAD',
          location_code: 'ITLIV',
          id: '00000000-0000-0000-0000-000000000013',
          fingerprint: 'fp3',
          event_time: '2025-11-30T00:00:00.000Z',
        }),
        makeObs({
          type: 'DISCHARGE',
          location_code: 'BRIOA',
          id: '00000000-0000-0000-0000-000000000016',
          fingerprint: 'fp6',
          event_time: '2026-02-02T00:00:00.000Z',
        }),
      ])

      const alerts = deriveAlerts(timeline, 'DISCHARGED', new Set())
      const transAlert = alerts.find((a) => a.type === 'TRANSSHIPMENT')
      expect(transAlert).toBeDefined()
      expect(transAlert?.category).toBe('fact')
      expect(transAlert?.severity).toBe('warning')
      expect(transAlert?.retroactive).toBe(false)
    })

    it('should mark TRANSSHIPMENT alert as retroactive during backfill', () => {
      const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
        makeObs({
          type: 'LOAD',
          location_code: 'ITNAP',
          id: '00000000-0000-0000-0000-000000000011',
          fingerprint: 'fp1',
        }),
        makeObs({
          type: 'DISCHARGE',
          location_code: 'ITLIV',
          id: '00000000-0000-0000-0000-000000000012',
          fingerprint: 'fp2',
          event_time: '2025-11-29T00:00:00.000Z',
        }),
        makeObs({
          type: 'LOAD',
          location_code: 'ITLIV',
          id: '00000000-0000-0000-0000-000000000013',
          fingerprint: 'fp3',
          event_time: '2025-11-30T00:00:00.000Z',
        }),
        makeObs({
          type: 'DISCHARGE',
          location_code: 'BRIOA',
          id: '00000000-0000-0000-0000-000000000016',
          fingerprint: 'fp6',
          event_time: '2026-02-02T00:00:00.000Z',
        }),
      ])

      const alerts = deriveAlerts(timeline, 'DISCHARGED', new Set(), true)
      const transAlert = alerts.find((a) => a.type === 'TRANSSHIPMENT')
      expect(transAlert?.retroactive).toBe(true)
    })

    it('should NOT create duplicate TRANSSHIPMENT alert if already exists', () => {
      const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
        makeObs({
          type: 'LOAD',
          location_code: 'ITNAP',
          id: '00000000-0000-0000-0000-000000000011',
          fingerprint: 'fp1',
        }),
        makeObs({
          type: 'DISCHARGE',
          location_code: 'ITLIV',
          id: '00000000-0000-0000-0000-000000000012',
          fingerprint: 'fp2',
          event_time: '2025-11-29T00:00:00.000Z',
        }),
        makeObs({
          type: 'LOAD',
          location_code: 'ITLIV',
          id: '00000000-0000-0000-0000-000000000013',
          fingerprint: 'fp3',
          event_time: '2025-11-30T00:00:00.000Z',
        }),
        makeObs({
          type: 'DISCHARGE',
          location_code: 'BRIOA',
          id: '00000000-0000-0000-0000-000000000016',
          fingerprint: 'fp6',
          event_time: '2026-02-02T00:00:00.000Z',
        }),
      ])

      const alerts = deriveAlerts(timeline, 'DISCHARGED', new Set(['TRANSSHIPMENT']))
      const transAlert = alerts.find((a) => a.type === 'TRANSSHIPMENT')
      expect(transAlert).toBeUndefined()
    })

    it('should NOT create TRANSSHIPMENT alert for direct route', () => {
      const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
        makeObs({
          type: 'LOAD',
          location_code: 'ITNAP',
          id: '00000000-0000-0000-0000-000000000011',
          fingerprint: 'fp1',
        }),
        makeObs({
          type: 'DISCHARGE',
          location_code: 'BRIOA',
          id: '00000000-0000-0000-0000-000000000012',
          fingerprint: 'fp2',
          event_time: '2026-02-02T00:00:00.000Z',
        }),
      ])

      const alerts = deriveAlerts(timeline, 'DISCHARGED', new Set())
      const transAlert = alerts.find((a) => a.type === 'TRANSSHIPMENT')
      expect(transAlert).toBeUndefined()
    })
  })

  describe('CUSTOMS_HOLD alert (fact-based)', () => {
    it('should create a CUSTOMS_HOLD alert when customs hold observed', () => {
      const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
        makeObs({
          type: 'CUSTOMS_HOLD',
          id: '00000000-0000-0000-0000-000000000011',
          fingerprint: 'fp1',
        }),
      ])

      const alerts = deriveAlerts(timeline, 'DISCHARGED', new Set())
      const customsAlert = alerts.find((a) => a.type === 'CUSTOMS_HOLD')
      expect(customsAlert).toBeDefined()
      expect(customsAlert?.category).toBe('fact')
      expect(customsAlert?.severity).toBe('danger')
    })
  })

  describe('NO_MOVEMENT alert (monitoring)', () => {
    it('should create NO_MOVEMENT alert when last event > 7 days ago', () => {
      const lastEventTime = '2025-11-01T00:00:00.000Z'
      const now = new Date('2025-11-20T00:00:00.000Z')
      const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
        makeObs({
          type: 'LOAD',
          event_time: lastEventTime,
          id: '00000000-0000-0000-0000-000000000011',
          fingerprint: 'fp1',
        }),
      ])

      const alerts = deriveAlerts(timeline, 'LOADED', new Set(), false, now)
      const noMoveAlert = alerts.find((a) => a.type === 'NO_MOVEMENT')
      expect(noMoveAlert).toBeDefined()
      expect(noMoveAlert?.category).toBe('monitoring')
      expect(noMoveAlert?.retroactive).toBe(false)
    })

    it('should NOT create NO_MOVEMENT alert during backfill', () => {
      const lastEventTime = '2025-11-01T00:00:00.000Z'
      const now = new Date('2025-11-20T00:00:00.000Z')
      const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
        makeObs({
          type: 'LOAD',
          event_time: lastEventTime,
          id: '00000000-0000-0000-0000-000000000011',
          fingerprint: 'fp1',
        }),
      ])

      const alerts = deriveAlerts(timeline, 'LOADED', new Set(), true, now)
      const noMoveAlert = alerts.find((a) => a.type === 'NO_MOVEMENT')
      expect(noMoveAlert).toBeUndefined()
    })

    it('should NOT create NO_MOVEMENT alert for DELIVERED containers', () => {
      const lastEventTime = '2025-11-01T00:00:00.000Z'
      const now = new Date('2025-11-20T00:00:00.000Z')
      const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
        makeObs({
          type: 'DELIVERY',
          event_time: lastEventTime,
          id: '00000000-0000-0000-0000-000000000011',
          fingerprint: 'fp1',
        }),
      ])

      const alerts = deriveAlerts(timeline, 'DELIVERED', new Set(), false, now)
      const noMoveAlert = alerts.find((a) => a.type === 'NO_MOVEMENT')
      expect(noMoveAlert).toBeUndefined()
    })

    it('should NOT create NO_MOVEMENT alert when recent events exist', () => {
      const now = new Date('2025-11-20T00:00:00.000Z')
      const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
        makeObs({
          type: 'LOAD',
          event_time: '2025-11-18T00:00:00.000Z',
          id: '00000000-0000-0000-0000-000000000011',
          fingerprint: 'fp1',
        }),
      ])

      const alerts = deriveAlerts(timeline, 'LOADED', new Set(), false, now)
      const noMoveAlert = alerts.find((a) => a.type === 'NO_MOVEMENT')
      expect(noMoveAlert).toBeUndefined()
    })
  })
})
