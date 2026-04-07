import { describe, expect, it } from 'vitest'
import {
  deriveAlerts,
  deriveTransshipment,
} from '~/modules/tracking/features/alerts/domain/derive/deriveAlerts'
import { computeAlertFingerprint } from '~/modules/tracking/features/alerts/domain/identity/alertFingerprint'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import {
  instantFromIsoText,
  resolveTemporalValue,
  temporalValueFromCanonical,
} from '~/shared/time/tests/helpers'

const CONTAINER_ID = '00000000-0000-0000-0000-000000000002'
const CONTAINER_NUMBER = 'CXDU2058677'
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
    ...rest,
  }
}

describe('deriveTransshipment', () => {
  it('should return no transshipment for a direct route (same vessel)', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'LOAD',
        location_code: 'CNSHA',
        vessel_name: 'VesselA',
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        event_time: '2025-11-17T00:00:00.000Z',
      }),
      makeObs({
        type: 'DISCHARGE',
        location_code: 'NLRTM',
        vessel_name: 'VesselA',
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2026-02-02T00:00:00.000Z',
      }),
    ])
    const result = deriveTransshipment(timeline)
    expect(result.hasTransshipment).toBe(false)
    expect(result.transshipmentCount).toBe(0)
    expect(result.ports).toHaveLength(0)
  })

  it('should return false for a port call / layover with no vessel change', () => {
    // ARRIVAL and DEPARTURE mid-route on the same vessel MUST NOT trigger transshipment
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'LOAD',
        location_code: 'CNSHA',
        vessel_name: 'VesselA',
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        event_time: '2025-11-17T00:00:00.000Z',
      }),
      makeObs({
        type: 'ARRIVAL',
        location_code: 'SGSIN',
        vessel_name: 'VesselA',
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2025-12-01T00:00:00.000Z',
      }),
      makeObs({
        type: 'DEPARTURE',
        location_code: 'SGSIN',
        vessel_name: 'VesselA',
        id: '00000000-0000-0000-0000-000000000013',
        fingerprint: 'fp3',
        event_time: '2025-12-02T00:00:00.000Z',
      }),
      makeObs({
        type: 'DISCHARGE',
        location_code: 'NLRTM',
        vessel_name: 'VesselA',
        id: '00000000-0000-0000-0000-000000000014',
        fingerprint: 'fp4',
        event_time: '2026-02-02T00:00:00.000Z',
      }),
    ])
    const result = deriveTransshipment(timeline)
    expect(result.hasTransshipment).toBe(false)
    expect(result.transshipmentCount).toBe(0)
  })

  it('should return false for a restow (DISCHARGE + LOAD on the same vessel)', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'LOAD',
        location_code: 'CNSHA',
        vessel_name: 'VesselA',
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        event_time: '2025-11-17T00:00:00.000Z',
      }),
      makeObs({
        type: 'DISCHARGE',
        location_code: 'SGSIN',
        vessel_name: 'VesselA',
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2025-12-01T00:00:00.000Z',
      }),
      makeObs({
        type: 'LOAD',
        location_code: 'SGSIN',
        vessel_name: 'VesselA',
        id: '00000000-0000-0000-0000-000000000013',
        fingerprint: 'fp3',
        event_time: '2025-12-02T00:00:00.000Z',
      }),
      makeObs({
        type: 'DISCHARGE',
        location_code: 'NLRTM',
        vessel_name: 'VesselA',
        id: '00000000-0000-0000-0000-000000000014',
        fingerprint: 'fp4',
        event_time: '2026-02-02T00:00:00.000Z',
      }),
    ])
    const result = deriveTransshipment(timeline)
    expect(result.hasTransshipment).toBe(false)
    expect(result.transshipmentCount).toBe(0)
  })

  it('should detect a real transshipment (DISCHARGE vessel A → LOAD vessel B)', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'LOAD',
        location_code: 'CNSHA',
        vessel_name: 'VesselA',
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        event_time: '2025-11-17T00:00:00.000Z',
      }),
      makeObs({
        type: 'DISCHARGE',
        location_code: 'SGSIN',
        vessel_name: 'VesselA',
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2025-12-01T00:00:00.000Z',
      }),
      makeObs({
        type: 'LOAD',
        location_code: 'SGSIN',
        vessel_name: 'VesselB',
        id: '00000000-0000-0000-0000-000000000013',
        fingerprint: 'fp3',
        event_time: '2025-12-03T00:00:00.000Z',
      }),
      makeObs({
        type: 'DISCHARGE',
        location_code: 'NLRTM',
        vessel_name: 'VesselB',
        id: '00000000-0000-0000-0000-000000000014',
        fingerprint: 'fp4',
        event_time: '2026-02-02T00:00:00.000Z',
      }),
    ])
    const result = deriveTransshipment(timeline)
    expect(result.hasTransshipment).toBe(true)
    expect(result.transshipmentCount).toBe(1)
    expect(result.ports).toEqual(['SGSIN'])
  })

  it('should ignore case-only and whitespace-only vessel name differences', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'LOAD',
        location_code: 'CNSHA',
        vessel_name: 'MAERSK',
        id: '00000000-0000-0000-0000-000000000021',
        fingerprint: 'fp-case-load-origin',
        event_time: '2025-11-17T00:00:00.000Z',
      }),
      makeObs({
        type: 'DISCHARGE',
        location_code: 'SGSIN',
        vessel_name: ' MAERSK ',
        id: '00000000-0000-0000-0000-000000000022',
        fingerprint: 'fp-case-discharge',
        event_time: '2025-12-01T00:00:00.000Z',
      }),
      makeObs({
        type: 'LOAD',
        location_code: 'SGSIN',
        vessel_name: 'Maersk',
        id: '00000000-0000-0000-0000-000000000023',
        fingerprint: 'fp-case-load',
        event_time: '2025-12-03T00:00:00.000Z',
      }),
    ])

    const result = deriveTransshipment(timeline)
    expect(result.hasTransshipment).toBe(false)
    expect(result.transshipmentCount).toBe(0)
  })

  it('should detect multiple transshipments when vessel changes twice', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'LOAD',
        location_code: 'CNSHA',
        vessel_name: 'VesselA',
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        event_time: '2025-11-17T00:00:00.000Z',
      }),
      makeObs({
        type: 'DISCHARGE',
        location_code: 'SGSIN',
        vessel_name: 'VesselA',
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2025-12-01T00:00:00.000Z',
      }),
      makeObs({
        type: 'LOAD',
        location_code: 'SGSIN',
        vessel_name: 'VesselB',
        id: '00000000-0000-0000-0000-000000000013',
        fingerprint: 'fp3',
        event_time: '2025-12-03T00:00:00.000Z',
      }),
      makeObs({
        type: 'DISCHARGE',
        location_code: 'BRSSZ',
        vessel_name: 'VesselB',
        id: '00000000-0000-0000-0000-000000000014',
        fingerprint: 'fp4',
        event_time: '2026-01-07T00:00:00.000Z',
      }),
      makeObs({
        type: 'LOAD',
        location_code: 'BRSSZ',
        vessel_name: 'VesselC',
        id: '00000000-0000-0000-0000-000000000015',
        fingerprint: 'fp5',
        event_time: '2026-01-10T00:00:00.000Z',
      }),
      makeObs({
        type: 'DISCHARGE',
        location_code: 'BRIOA',
        vessel_name: 'VesselC',
        id: '00000000-0000-0000-0000-000000000016',
        fingerprint: 'fp6',
        event_time: '2026-02-02T00:00:00.000Z',
      }),
    ])
    const result = deriveTransshipment(timeline)
    expect(result.hasTransshipment).toBe(true)
    expect(result.transshipmentCount).toBe(2)
    expect(result.ports).toContain('SGSIN')
    expect(result.ports).toContain('BRSSZ')
  })

  it('should return false when vessel names are unknown (cannot determine change)', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'LOAD',
        location_code: 'CNSHA',
        vessel_name: null,
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        event_time: '2025-11-17T00:00:00.000Z',
      }),
      makeObs({
        type: 'DISCHARGE',
        location_code: 'SGSIN',
        vessel_name: null,
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2025-12-01T00:00:00.000Z',
      }),
      makeObs({
        type: 'LOAD',
        location_code: 'SGSIN',
        vessel_name: null,
        id: '00000000-0000-0000-0000-000000000013',
        fingerprint: 'fp3',
        event_time: '2025-12-03T00:00:00.000Z',
      }),
      makeObs({
        type: 'DISCHARGE',
        location_code: 'NLRTM',
        vessel_name: null,
        id: '00000000-0000-0000-0000-000000000014',
        fingerprint: 'fp4',
        event_time: '2026-02-02T00:00:00.000Z',
      }),
    ])
    const result = deriveTransshipment(timeline)
    expect(result.hasTransshipment).toBe(false)
    expect(result.transshipmentCount).toBe(0)
  })

  it('should ignore EXPECTED observations', () => {
    // Even if vessel names differ, EXPECTED events must not drive transshipment
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'LOAD',
        location_code: 'CNSHA',
        vessel_name: 'VesselA',
        event_time_type: 'EXPECTED',
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        event_time: '2025-11-17T00:00:00.000Z',
      }),
      makeObs({
        type: 'DISCHARGE',
        location_code: 'SGSIN',
        vessel_name: 'VesselA',
        event_time_type: 'EXPECTED',
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2025-12-01T00:00:00.000Z',
      }),
      makeObs({
        type: 'LOAD',
        location_code: 'SGSIN',
        vessel_name: 'VesselB',
        event_time_type: 'EXPECTED',
        id: '00000000-0000-0000-0000-000000000013',
        fingerprint: 'fp3',
        event_time: '2025-12-03T00:00:00.000Z',
      }),
    ])
    const result = deriveTransshipment(timeline)
    expect(result.hasTransshipment).toBe(false)
  })

  it('should keep null event_time observations after dated events for transshipment ordering', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'DISCHARGE',
        location_code: 'SGSIN',
        vessel_name: 'VesselA',
        id: '00000000-0000-0000-0000-000000000021',
        fingerprint: 'fp-null-discharge',
        event_time: null,
        created_at: '2025-12-05T00:00:00.000Z',
      }),
      makeObs({
        type: 'LOAD',
        location_code: 'CNSHA',
        vessel_name: 'VesselB',
        id: '00000000-0000-0000-0000-000000000022',
        fingerprint: 'fp-dated-load',
        event_time: '2025-11-17T00:00:00.000Z',
        created_at: '2025-11-17T00:00:00.000Z',
      }),
    ])

    const result = deriveTransshipment(timeline)

    expect(timeline.observations.map((observation) => observation.fingerprint)).toEqual([
      'fp-dated-load',
      'fp-null-discharge',
    ])
    expect(result.hasTransshipment).toBe(false)
    expect(result.transshipmentCount).toBe(0)
  })

  it('should use canonical created_at tie-breaking when event_time values are equal', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'LOAD',
        location_code: 'SGSIN',
        vessel_name: 'VesselB',
        id: '00000000-0000-0000-0000-000000000023',
        fingerprint: 'fp-load-same-time',
        event_time: '2025-12-03T00:00:00.000Z',
        created_at: '2025-12-03T00:00:00.000Z',
      }),
      makeObs({
        type: 'DISCHARGE',
        location_code: 'SGSIN',
        vessel_name: 'VesselA',
        id: '00000000-0000-0000-0000-000000000024',
        fingerprint: 'fp-discharge-same-time',
        event_time: '2025-12-03T00:00:00.000Z',
        created_at: '2025-12-04T00:00:00.000Z',
      }),
    ])

    const result = deriveTransshipment(timeline)

    expect(timeline.observations.map((observation) => observation.fingerprint)).toEqual([
      'fp-load-same-time',
      'fp-discharge-same-time',
    ])
    expect(result.hasTransshipment).toBe(false)
    expect(result.transshipmentCount).toBe(0)
  })
})

describe('deriveAlerts', () => {
  describe('TRANSSHIPMENT alert (fact-based)', () => {
    function makeTransshipmentTimeline(dischargeFingerprint: string, loadFingerprint: string) {
      return deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
        makeObs({
          type: 'LOAD',
          location_code: 'CNSHA',
          vessel_name: 'VesselA',
          id: '00000000-0000-0000-0000-000000000011',
          fingerprint: 'fp-load-origin',
          event_time: '2025-11-17T00:00:00.000Z',
        }),
        makeObs({
          type: 'DISCHARGE',
          location_code: 'SGSIN',
          vessel_name: 'VesselA',
          id: '00000000-0000-0000-0000-000000000012',
          fingerprint: dischargeFingerprint,
          event_time: '2025-12-01T00:00:00.000Z',
        }),
        makeObs({
          type: 'LOAD',
          location_code: 'SGSIN',
          vessel_name: 'VesselB',
          id: '00000000-0000-0000-0000-000000000013',
          fingerprint: loadFingerprint,
          event_time: '2025-12-03T00:00:00.000Z',
        }),
        makeObs({
          type: 'DISCHARGE',
          location_code: 'NLRTM',
          vessel_name: 'VesselB',
          id: '00000000-0000-0000-0000-000000000014',
          fingerprint: 'fp-discharge-dest',
          event_time: '2026-02-02T00:00:00.000Z',
        }),
      ])
    }

    it('should create a TRANSSHIPMENT alert for a vessel change', () => {
      const timeline = makeTransshipmentTimeline('fp-discharge-sgsin', 'fp-load-sgsin')

      const alerts = deriveAlerts(timeline, 'DISCHARGED', [])
      const transAlert = alerts.find((a) => a.type === 'TRANSSHIPMENT')
      expect(transAlert).toBeDefined()
      expect(transAlert?.category).toBe('fact')
      expect(transAlert?.severity).toBe('warning')
      expect(transAlert?.retroactive).toBe(false)
      expect(transAlert?.alert_fingerprint).toBeTruthy()
      // detected_at = time of LOAD onto new vessel
      expect(transAlert?.detected_at).toBe('2025-12-03T00:00:00.000Z')
      expect(transAlert?.message_key).toBe('alerts.transshipmentDetected')
      expect(transAlert?.message_params).toEqual({
        port: 'SGSIN',
        fromVessel: 'VesselA',
        toVessel: 'VesselB',
      })
      // source fingerprints = [discharge, load]
      expect(transAlert?.source_observation_fingerprints).toContain('fp-discharge-sgsin')
      expect(transAlert?.source_observation_fingerprints).toContain('fp-load-sgsin')
    })

    it('should preserve original vessel casing in alert messages', () => {
      const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
        makeObs({
          type: 'LOAD',
          location_code: 'CNSHA',
          vessel_name: 'Maersk Aurora',
          id: '00000000-0000-0000-0000-000000000031',
          fingerprint: 'fp-alert-load-origin',
          event_time: '2025-11-17T00:00:00.000Z',
        }),
        makeObs({
          type: 'DISCHARGE',
          location_code: 'SGSIN',
          vessel_name: 'Maersk Aurora',
          id: '00000000-0000-0000-0000-000000000032',
          fingerprint: 'fp-alert-discharge',
          event_time: '2025-12-01T00:00:00.000Z',
        }),
        makeObs({
          type: 'LOAD',
          location_code: 'SGSIN',
          vessel_name: 'Msc Bianca Silvia',
          id: '00000000-0000-0000-0000-000000000033',
          fingerprint: 'fp-alert-load',
          event_time: '2025-12-03T00:00:00.000Z',
        }),
      ])

      const alerts = deriveAlerts(timeline, 'LOADED', [])
      const transAlert = alerts.find((a) => a.type === 'TRANSSHIPMENT')

      expect(transAlert?.message_params).toEqual({
        port: 'SGSIN',
        fromVessel: 'Maersk Aurora',
        toVessel: 'Msc Bianca Silvia',
      })
    })

    it('should mark TRANSSHIPMENT alert as retroactive during backfill', () => {
      const timeline = makeTransshipmentTimeline('fp-discharge-sgsin', 'fp-load-sgsin')
      const alerts = deriveAlerts(timeline, 'DISCHARGED', [], true)
      const transAlert = alerts.find((a) => a.type === 'TRANSSHIPMENT')
      expect(transAlert?.retroactive).toBe(true)
    })

    it('should NOT create duplicate TRANSSHIPMENT alert if already exists (dedup by fingerprint)', () => {
      const timeline = makeTransshipmentTimeline('fp-discharge-sgsin', 'fp-load-sgsin')

      const existingFingerprint = computeAlertFingerprint('TRANSSHIPMENT', [
        'fp-discharge-sgsin',
        'fp-load-sgsin',
      ])
      const existingAlerts = [
        {
          id: '00000000-0000-0000-0000-999999999999',
          container_id: CONTAINER_ID,
          category: 'fact' as const,
          type: 'TRANSSHIPMENT' as const,
          severity: 'warning' as const,
          message_key: 'alerts.transshipmentDetected' as const,
          message_params: {
            port: 'SGSIN',
            fromVessel: 'VesselA',
            toVessel: 'VesselB',
          },
          detected_at: '2025-12-03T00:00:00.000Z',
          triggered_at: '2025-12-03T00:00:00.000Z',
          source_observation_fingerprints: ['fp-discharge-sgsin', 'fp-load-sgsin'],
          alert_fingerprint: existingFingerprint,
          retroactive: false,
          provider: null,
          acked_at: null,
          acked_by: null,
          acked_source: null,
        },
      ]
      const alerts = deriveAlerts(timeline, 'DISCHARGED', existingAlerts)
      const transAlert = alerts.find((a) => a.type === 'TRANSSHIPMENT')
      expect(transAlert).toBeUndefined()
    })

    it('should not emit a TRANSSHIPMENT alert from a null-time discharge sorted ahead of a dated load', () => {
      const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
        makeObs({
          type: 'DISCHARGE',
          location_code: 'SGSIN',
          vessel_name: 'VesselA',
          id: '00000000-0000-0000-0000-000000000031',
          fingerprint: 'fp-null-discharge-alert',
          event_time: null,
          created_at: '2025-12-05T00:00:00.000Z',
        }),
        makeObs({
          type: 'LOAD',
          location_code: 'CNSHA',
          vessel_name: 'VesselB',
          id: '00000000-0000-0000-0000-000000000032',
          fingerprint: 'fp-dated-load-alert',
          event_time: '2025-11-17T00:00:00.000Z',
          created_at: '2025-11-17T00:00:00.000Z',
        }),
      ])

      const alerts = deriveAlerts(timeline, 'LOADED', [])

      expect(alerts.some((alert) => alert.type === 'TRANSSHIPMENT')).toBe(false)
    })

    it('should NOT create duplicate TRANSSHIPMENT alert when matching fingerprint is acknowledged', () => {
      const timeline = makeTransshipmentTimeline('fp-discharge-sgsin', 'fp-load-sgsin')

      const existingFingerprint = computeAlertFingerprint('TRANSSHIPMENT', [
        'fp-discharge-sgsin',
        'fp-load-sgsin',
      ])
      const existingAlerts = [
        {
          id: '00000000-0000-0000-0000-999999999998',
          container_id: CONTAINER_ID,
          category: 'fact' as const,
          type: 'TRANSSHIPMENT' as const,
          severity: 'warning' as const,
          message_key: 'alerts.transshipmentDetected' as const,
          message_params: {
            port: 'SGSIN',
            fromVessel: 'VesselA',
            toVessel: 'VesselB',
          },
          detected_at: '2025-12-03T00:00:00.000Z',
          triggered_at: '2025-12-03T00:00:00.000Z',
          source_observation_fingerprints: ['fp-discharge-sgsin', 'fp-load-sgsin'],
          alert_fingerprint: existingFingerprint,
          retroactive: false,
          provider: null,
          acked_at: '2025-12-04T10:00:00.000Z',
          acked_by: 'operator@test',
          acked_source: 'dashboard' as const,
        },
      ]
      const alerts = deriveAlerts(timeline, 'DISCHARGED', existingAlerts)
      const transAlert = alerts.find((a) => a.type === 'TRANSSHIPMENT')
      expect(transAlert).toBeUndefined()
    })

    it('should create separate alerts for each vessel-change pair', () => {
      // Two transshipments: CNSHA → SGSIN (A→B) → BRSSZ (B→C) → BRIOA
      const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
        makeObs({
          type: 'LOAD',
          location_code: 'CNSHA',
          vessel_name: 'VesselA',
          id: '00000000-0000-0000-0000-000000000011',
          fingerprint: 'fp1',
          event_time: '2025-11-17T00:00:00.000Z',
        }),
        makeObs({
          type: 'DISCHARGE',
          location_code: 'SGSIN',
          vessel_name: 'VesselA',
          id: '00000000-0000-0000-0000-000000000012',
          fingerprint: 'fp2',
          event_time: '2025-12-01T00:00:00.000Z',
        }),
        makeObs({
          type: 'LOAD',
          location_code: 'SGSIN',
          vessel_name: 'VesselB',
          id: '00000000-0000-0000-0000-000000000013',
          fingerprint: 'fp3',
          event_time: '2025-12-03T00:00:00.000Z',
        }),
        makeObs({
          type: 'DISCHARGE',
          location_code: 'BRSSZ',
          vessel_name: 'VesselB',
          id: '00000000-0000-0000-0000-000000000014',
          fingerprint: 'fp4',
          event_time: '2026-01-07T00:00:00.000Z',
        }),
        makeObs({
          type: 'LOAD',
          location_code: 'BRSSZ',
          vessel_name: 'VesselC',
          id: '00000000-0000-0000-0000-000000000015',
          fingerprint: 'fp5',
          event_time: '2026-01-10T00:00:00.000Z',
        }),
        makeObs({
          type: 'DISCHARGE',
          location_code: 'BRIOA',
          vessel_name: 'VesselC',
          id: '00000000-0000-0000-0000-000000000016',
          fingerprint: 'fp6',
          event_time: '2026-02-02T00:00:00.000Z',
        }),
      ])

      const alerts = deriveAlerts(timeline, 'DISCHARGED', [])
      const transAlerts = alerts.filter((a) => a.type === 'TRANSSHIPMENT')
      expect(transAlerts).toHaveLength(2)
      expect(transAlerts[0]?.alert_fingerprint).not.toBe(transAlerts[1]?.alert_fingerprint)
    })

    it('should NOT create TRANSSHIPMENT alert for a direct route (same vessel)', () => {
      const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
        makeObs({
          type: 'LOAD',
          location_code: 'CNSHA',
          vessel_name: 'VesselA',
          id: '00000000-0000-0000-0000-000000000011',
          fingerprint: 'fp1',
          event_time: '2025-11-17T00:00:00.000Z',
        }),
        makeObs({
          type: 'DISCHARGE',
          location_code: 'NLRTM',
          vessel_name: 'VesselA',
          id: '00000000-0000-0000-0000-000000000012',
          fingerprint: 'fp2',
          event_time: '2026-02-02T00:00:00.000Z',
        }),
      ])

      const alerts = deriveAlerts(timeline, 'DISCHARGED', [])
      const transAlert = alerts.find((a) => a.type === 'TRANSSHIPMENT')
      expect(transAlert).toBeUndefined()
    })

    it('should NOT create TRANSSHIPMENT alert for a restow (same vessel)', () => {
      const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
        makeObs({
          type: 'LOAD',
          location_code: 'CNSHA',
          vessel_name: 'VesselA',
          id: '00000000-0000-0000-0000-000000000011',
          fingerprint: 'fp1',
          event_time: '2025-11-17T00:00:00.000Z',
        }),
        makeObs({
          type: 'DISCHARGE',
          location_code: 'SGSIN',
          vessel_name: 'VesselA',
          id: '00000000-0000-0000-0000-000000000012',
          fingerprint: 'fp2',
          event_time: '2025-12-01T00:00:00.000Z',
        }),
        makeObs({
          type: 'LOAD',
          location_code: 'SGSIN',
          vessel_name: 'VesselA',
          id: '00000000-0000-0000-0000-000000000013',
          fingerprint: 'fp3',
          event_time: '2025-12-02T00:00:00.000Z',
        }),
        makeObs({
          type: 'DISCHARGE',
          location_code: 'NLRTM',
          vessel_name: 'VesselA',
          id: '00000000-0000-0000-0000-000000000014',
          fingerprint: 'fp4',
          event_time: '2026-02-02T00:00:00.000Z',
        }),
      ])

      const alerts = deriveAlerts(timeline, 'DISCHARGED', [])
      const transAlert = alerts.find((a) => a.type === 'TRANSSHIPMENT')
      expect(transAlert).toBeUndefined()
    })

    it('should NOT create TRANSSHIPMENT alert when vessel names are unknown', () => {
      const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
        makeObs({
          type: 'LOAD',
          location_code: 'CNSHA',
          vessel_name: null,
          id: '00000000-0000-0000-0000-000000000011',
          fingerprint: 'fp1',
          event_time: '2025-11-17T00:00:00.000Z',
        }),
        makeObs({
          type: 'DISCHARGE',
          location_code: 'SGSIN',
          vessel_name: null,
          id: '00000000-0000-0000-0000-000000000012',
          fingerprint: 'fp2',
          event_time: '2025-12-01T00:00:00.000Z',
        }),
        makeObs({
          type: 'LOAD',
          location_code: 'SGSIN',
          vessel_name: null,
          id: '00000000-0000-0000-0000-000000000013',
          fingerprint: 'fp3',
          event_time: '2025-12-03T00:00:00.000Z',
        }),
        makeObs({
          type: 'DISCHARGE',
          location_code: 'NLRTM',
          vessel_name: null,
          id: '00000000-0000-0000-0000-000000000014',
          fingerprint: 'fp4',
          event_time: '2026-02-02T00:00:00.000Z',
        }),
      ])

      const alerts = deriveAlerts(timeline, 'DISCHARGED', [])
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

      const alerts = deriveAlerts(timeline, 'DISCHARGED', [])
      const customsAlert = alerts.find((a) => a.type === 'CUSTOMS_HOLD')
      expect(customsAlert).toBeDefined()
      expect(customsAlert?.category).toBe('fact')
      expect(customsAlert?.severity).toBe('danger')
      expect(customsAlert?.alert_fingerprint).toBeTruthy()
      expect(customsAlert?.message_key).toBe('alerts.customsHoldDetected')
      expect(customsAlert?.message_params).toEqual({
        location: 'NAPLES, IT',
      })
    })
  })

  describe('monitoring alert removal', () => {
    it('does not derive alerts for stale timelines without fact-based signals', () => {
      const now = instantFromIsoText('2025-11-20T00:00:00.000Z')
      const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
        makeObs({
          type: 'LOAD',
          event_time: '2025-11-01T00:00:00.000Z',
          id: '00000000-0000-0000-0000-000000000016',
          fingerprint: 'fp-stale-load',
        }),
      ])

      const alerts = deriveAlerts(timeline, 'LOADED', [], false, now)

      expect(alerts).toEqual([])
    })

    it('keeps alerts empty for a closed lifecycle DISCHARGED -> DELIVERY -> EMPTY_RETURN', () => {
      const now = instantFromIsoText('2026-03-20T00:00:00.000Z')
      const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
        makeObs({
          type: 'DISCHARGE',
          event_time: '2026-03-01T00:00:00.000Z',
          id: '00000000-0000-0000-0000-000000000021',
          fingerprint: 'fp21',
        }),
        makeObs({
          type: 'DELIVERY',
          event_time: '2026-03-05T00:00:00.000Z',
          id: '00000000-0000-0000-0000-000000000022',
          fingerprint: 'fp22',
        }),
        makeObs({
          type: 'EMPTY_RETURN',
          event_time: '2026-03-08T00:00:00.000Z',
          id: '00000000-0000-0000-0000-000000000023',
          fingerprint: 'fp23',
        }),
      ])

      const status = deriveStatus(timeline)
      expect(status).toBe('EMPTY_RETURNED')

      const alerts = deriveAlerts(timeline, status, [], false, now)
      expect(alerts).toEqual([])
    })
  })
})
