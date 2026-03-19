import { describe, expect, it } from 'vitest'
import { deriveAlerts } from '~/modules/tracking/features/alerts/domain/derive/deriveAlerts'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
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

describe('ACTUAL vs EXPECTED differentiation', () => {
  // Use a `now` before all test event times to prevent reconciliation from filtering EXPECTED
  const now = instantFromIsoText('2025-11-01T00:00:00.000Z')

  describe('Timeline sorting', () => {
    it('should sort ACTUAL before EXPECTED when event times are equal', () => {
      const obs = [
        makeObs({
          id: '00000000-0000-0000-0000-000000000011',
          fingerprint: 'fp-expected',
          type: 'ARRIVAL',
          event_time: '2025-11-17T12:00:00.000Z',
          event_time_type: 'EXPECTED',
          created_at: '2025-11-17T10:00:00.000Z',
        }),
        makeObs({
          id: '00000000-0000-0000-0000-000000000012',
          fingerprint: 'fp-actual',
          type: 'DEPARTURE',
          event_time: '2025-11-17T12:00:00.000Z',
          event_time_type: 'ACTUAL',
          created_at: '2025-11-17T11:00:00.000Z',
        }),
      ]
      const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, obs, now)
      // ACTUAL should come first even though created_at is later
      expect(timeline.observations[0]?.event_time_type).toBe('ACTUAL')
      expect(timeline.observations[0]?.fingerprint).toBe('fp-actual')
      expect(timeline.observations[1]?.event_time_type).toBe('EXPECTED')
      expect(timeline.observations[1]?.fingerprint).toBe('fp-expected')
    })

    it('should sort by event_time first, then ACTUAL before EXPECTED', () => {
      const obs = [
        makeObs({
          id: '00000000-0000-0000-0000-000000000011',
          fingerprint: 'fp1',
          type: 'ARRIVAL',
          event_time: '2025-11-20T12:00:00.000Z',
          event_time_type: 'EXPECTED',
        }),
        makeObs({
          id: '00000000-0000-0000-0000-000000000012',
          fingerprint: 'fp2',
          type: 'DEPARTURE',
          event_time: '2025-11-18T12:00:00.000Z',
          event_time_type: 'ACTUAL',
        }),
        makeObs({
          id: '00000000-0000-0000-0000-000000000013',
          fingerprint: 'fp3',
          type: 'LOAD',
          event_time: '2025-11-18T12:00:00.000Z',
          event_time_type: 'EXPECTED',
        }),
      ]
      const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, obs, now)
      // First: ACTUAL on 11/18
      expect(timeline.observations[0]?.fingerprint).toBe('fp2')
      // Second: EXPECTED on 11/18 (same time but ACTUAL has precedence)
      expect(timeline.observations[1]?.fingerprint).toBe('fp3')
      // Third: EXPECTED on 11/20
      expect(timeline.observations[2]?.fingerprint).toBe('fp1')
    })
  })

  describe('Status derivation', () => {
    it('should advance status with ACTUAL ARRIVAL but not EXPECTED ARRIVAL', () => {
      // Timeline with only EXPECTED arrival
      const timelineExpected = deriveTimeline(
        CONTAINER_ID,
        CONTAINER_NUMBER,
        [
          makeObs({
            type: 'LOAD',
            event_time_type: 'ACTUAL',
            id: '00000000-0000-0000-0000-000000000011',
            fingerprint: 'fp1',
          }),
          makeObs({
            type: 'ARRIVAL',
            event_time_type: 'EXPECTED',
            id: '00000000-0000-0000-0000-000000000012',
            fingerprint: 'fp2',
            event_time: '2025-12-01T00:00:00.000Z',
          }),
        ],
        now,
      )
      // Status should be LOADED (EXPECTED ARRIVAL doesn't advance status)
      expect(deriveStatus(timelineExpected)).toBe('LOADED')

      // Timeline with ACTUAL arrival
      const timelineActual = deriveTimeline(
        CONTAINER_ID,
        CONTAINER_NUMBER,
        [
          makeObs({
            type: 'LOAD',
            event_time_type: 'ACTUAL',
            id: '00000000-0000-0000-0000-000000000011',
            fingerprint: 'fp1',
          }),
          makeObs({
            type: 'ARRIVAL',
            event_time_type: 'ACTUAL',
            id: '00000000-0000-0000-0000-000000000013',
            fingerprint: 'fp3',
            event_time: '2025-12-01T00:00:00.000Z',
          }),
        ],
        now,
      )
      // Status should advance to ARRIVED_AT_POD
      expect(deriveStatus(timelineActual)).toBe('ARRIVED_AT_POD')
    })

    it('should advance status with ACTUAL DISCHARGE but not EXPECTED DISCHARGE', () => {
      const timelineExpected = deriveTimeline(
        CONTAINER_ID,
        CONTAINER_NUMBER,
        [
          makeObs({
            type: 'ARRIVAL',
            event_time_type: 'ACTUAL',
            id: '00000000-0000-0000-0000-000000000011',
            fingerprint: 'fp1',
          }),
          makeObs({
            type: 'DISCHARGE',
            event_time_type: 'EXPECTED',
            id: '00000000-0000-0000-0000-000000000012',
            fingerprint: 'fp2',
            event_time: '2025-12-02T00:00:00.000Z',
          }),
        ],
        now,
      )
      expect(deriveStatus(timelineExpected)).toBe('ARRIVED_AT_POD')

      const timelineActual = deriveTimeline(
        CONTAINER_ID,
        CONTAINER_NUMBER,
        [
          makeObs({
            type: 'ARRIVAL',
            event_time_type: 'ACTUAL',
            id: '00000000-0000-0000-0000-000000000011',
            fingerprint: 'fp1',
          }),
          makeObs({
            type: 'DISCHARGE',
            event_time_type: 'ACTUAL',
            id: '00000000-0000-0000-0000-000000000013',
            fingerprint: 'fp3',
            event_time: '2025-12-02T00:00:00.000Z',
          }),
        ],
        now,
      )
      expect(deriveStatus(timelineActual)).toBe('DISCHARGED')
    })

    it('should handle ACTUAL arrival before EXPECTED arrival (early arrival)', () => {
      const timeline = deriveTimeline(
        CONTAINER_ID,
        CONTAINER_NUMBER,
        [
          makeObs({
            type: 'LOAD',
            event_time_type: 'ACTUAL',
            id: '00000000-0000-0000-0000-000000000011',
            fingerprint: 'fp1',
            event_time: '2025-11-20T00:00:00.000Z',
          }),
          makeObs({
            type: 'ARRIVAL',
            event_time_type: 'EXPECTED',
            id: '00000000-0000-0000-0000-000000000012',
            fingerprint: 'fp2',
            event_time: '2025-12-05T00:00:00.000Z',
          }),
          makeObs({
            type: 'ARRIVAL',
            event_time_type: 'ACTUAL',
            id: '00000000-0000-0000-0000-000000000013',
            fingerprint: 'fp3',
            event_time: '2025-12-01T00:00:00.000Z', // Arrived early
          }),
        ],
        now,
      )
      // Status should be ARRIVED_AT_POD (from ACTUAL)
      expect(deriveStatus(timeline)).toBe('ARRIVED_AT_POD')
      // ACTUAL should be sorted before EXPECTED
      const arrivalObs = timeline.observations.filter((o) => o.type === 'ARRIVAL')
      expect(arrivalObs[0]?.event_time_type).toBe('ACTUAL')
      expect(arrivalObs[1]?.event_time_type).toBe('EXPECTED')
    })

    it('should handle EXPECTED that never becomes ACTUAL', () => {
      const timeline = deriveTimeline(
        CONTAINER_ID,
        CONTAINER_NUMBER,
        [
          makeObs({
            type: 'LOAD',
            event_time_type: 'ACTUAL',
            id: '00000000-0000-0000-0000-000000000011',
            fingerprint: 'fp1',
            event_time: '2025-11-20T00:00:00.000Z',
          }),
          makeObs({
            type: 'ARRIVAL',
            event_time_type: 'EXPECTED',
            id: '00000000-0000-0000-0000-000000000012',
            fingerprint: 'fp2',
            event_time: '2025-12-05T00:00:00.000Z',
          }),
          // No ACTUAL arrival happens
        ],
        now,
      )
      // Status should remain LOADED (EXPECTED doesn't advance it)
      expect(deriveStatus(timeline)).toBe('LOADED')
      // Timeline should still contain the EXPECTED observation for audit
      expect(timeline.observations).toHaveLength(2)
      expect(timeline.observations[1]?.event_time_type).toBe('EXPECTED')
    })

    it('should only consider ACTUAL observations for status with mixed ACTUAL/EXPECTED events', () => {
      const timeline = deriveTimeline(
        CONTAINER_ID,
        CONTAINER_NUMBER,
        [
          makeObs({
            type: 'GATE_IN',
            event_time_type: 'ACTUAL',
            id: '00000000-0000-0000-0000-000000000011',
            fingerprint: 'fp1',
          }),
          makeObs({
            type: 'LOAD',
            event_time_type: 'EXPECTED',
            id: '00000000-0000-0000-0000-000000000012',
            fingerprint: 'fp2',
            event_time: '2025-11-25T00:00:00.000Z',
          }),
          makeObs({
            type: 'DEPARTURE',
            event_time_type: 'EXPECTED',
            id: '00000000-0000-0000-0000-000000000013',
            fingerprint: 'fp3',
            event_time: '2025-11-26T00:00:00.000Z',
          }),
          makeObs({
            type: 'ARRIVAL',
            event_time_type: 'EXPECTED',
            id: '00000000-0000-0000-0000-000000000014',
            fingerprint: 'fp4',
            event_time: '2025-12-10T00:00:00.000Z',
          }),
        ],
        now,
      )
      // Only GATE_IN is ACTUAL, so status should be IN_PROGRESS
      expect(deriveStatus(timeline)).toBe('IN_PROGRESS')
    })
  })

  describe('Alerts derivation', () => {
    it('should create TRANSSHIPMENT alert only with ACTUAL observations', () => {
      // Timeline with EXPECTED transshipment observations
      const timelineExpected = deriveTimeline(
        CONTAINER_ID,
        CONTAINER_NUMBER,
        [
          makeObs({
            type: 'LOAD',
            location_code: 'ITNAP',
            event_time_type: 'EXPECTED',
            id: '00000000-0000-0000-0000-000000000011',
            fingerprint: 'fp1',
          }),
          makeObs({
            type: 'DISCHARGE',
            location_code: 'ITLIV',
            event_time_type: 'EXPECTED',
            id: '00000000-0000-0000-0000-000000000012',
            fingerprint: 'fp2',
            event_time: '2025-11-25T00:00:00.000Z',
          }),
          makeObs({
            type: 'LOAD',
            location_code: 'ITLIV',
            event_time_type: 'EXPECTED',
            id: '00000000-0000-0000-0000-000000000013',
            fingerprint: 'fp3',
            event_time: '2025-11-26T00:00:00.000Z',
          }),
          makeObs({
            type: 'DISCHARGE',
            location_code: 'BRSSZ',
            event_time_type: 'EXPECTED',
            id: '00000000-0000-0000-0000-000000000014',
            fingerprint: 'fp4',
            event_time: '2025-12-10T00:00:00.000Z',
          }),
        ],
        now,
      )
      const alertsExpected = deriveAlerts(timelineExpected, 'LOADED', [])
      const transAlertExpected = alertsExpected.find((a) => a.type === 'TRANSSHIPMENT')
      // Should NOT create alert based on EXPECTED observations only
      expect(transAlertExpected).toBeUndefined()

      // Timeline with ACTUAL transshipment observations (with vessel change evidence)
      const timelineActual = deriveTimeline(
        CONTAINER_ID,
        CONTAINER_NUMBER,
        [
          makeObs({
            type: 'LOAD',
            location_code: 'ITNAP',
            event_time_type: 'ACTUAL',
            vessel_name: 'VesselA',
            id: '00000000-0000-0000-0000-000000000011',
            fingerprint: 'fp1',
          }),
          makeObs({
            type: 'DISCHARGE',
            location_code: 'ITLIV',
            event_time_type: 'ACTUAL',
            vessel_name: 'VesselA',
            id: '00000000-0000-0000-0000-000000000012',
            fingerprint: 'fp2',
            event_time: '2025-11-25T00:00:00.000Z',
          }),
          makeObs({
            type: 'LOAD',
            location_code: 'ITLIV',
            event_time_type: 'ACTUAL',
            vessel_name: 'VesselB',
            id: '00000000-0000-0000-0000-000000000013',
            fingerprint: 'fp3',
            event_time: '2025-11-26T00:00:00.000Z',
          }),
          makeObs({
            type: 'DISCHARGE',
            location_code: 'BRSSZ',
            event_time_type: 'ACTUAL',
            vessel_name: 'VesselB',
            id: '00000000-0000-0000-0000-000000000014',
            fingerprint: 'fp4',
            event_time: '2025-12-10T00:00:00.000Z',
          }),
        ],
        now,
      )
      const alertsActual = deriveAlerts(timelineActual, 'DISCHARGED', [])
      const transAlertActual = alertsActual.find((a) => a.type === 'TRANSSHIPMENT')
      // Should create alert based on ACTUAL vessel-change evidence
      expect(transAlertActual).toBeDefined()
      expect(transAlertActual?.category).toBe('fact')
    })

    it('should create CUSTOMS_HOLD alert only with ACTUAL observations', () => {
      // EXPECTED customs hold
      const timelineExpected = deriveTimeline(
        CONTAINER_ID,
        CONTAINER_NUMBER,
        [
          makeObs({
            type: 'DISCHARGE',
            event_time_type: 'ACTUAL',
            id: '00000000-0000-0000-0000-000000000011',
            fingerprint: 'fp1',
          }),
          makeObs({
            type: 'CUSTOMS_HOLD',
            event_time_type: 'EXPECTED',
            id: '00000000-0000-0000-0000-000000000012',
            fingerprint: 'fp2',
            event_time: '2025-12-02T00:00:00.000Z',
          }),
        ],
        now,
      )
      const alertsExpected = deriveAlerts(timelineExpected, 'DISCHARGED', [])
      const customsAlertExpected = alertsExpected.find((a) => a.type === 'CUSTOMS_HOLD')
      // Should NOT create alert for EXPECTED customs hold
      expect(customsAlertExpected).toBeUndefined()

      // ACTUAL customs hold
      const timelineActual = deriveTimeline(
        CONTAINER_ID,
        CONTAINER_NUMBER,
        [
          makeObs({
            type: 'DISCHARGE',
            event_time_type: 'ACTUAL',
            id: '00000000-0000-0000-0000-000000000011',
            fingerprint: 'fp1',
          }),
          makeObs({
            type: 'CUSTOMS_HOLD',
            event_time_type: 'ACTUAL',
            id: '00000000-0000-0000-0000-000000000013',
            fingerprint: 'fp3',
            event_time: '2025-12-02T00:00:00.000Z',
          }),
        ],
        now,
      )
      const alertsActual = deriveAlerts(timelineActual, 'DISCHARGED', [])
      const customsAlertActual = alertsActual.find((a) => a.type === 'CUSTOMS_HOLD')
      // Should create alert for ACTUAL customs hold
      expect(customsAlertActual).toBeDefined()
      expect(customsAlertActual?.category).toBe('fact')
    })
  })
})
