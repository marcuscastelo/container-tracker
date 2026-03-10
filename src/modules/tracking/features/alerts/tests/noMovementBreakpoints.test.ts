import { describe, expect, it } from 'vitest'
import { deriveAlerts } from '~/modules/tracking/features/alerts/domain/derive/deriveAlerts'
import { computeNoMovementAlertFingerprint } from '~/modules/tracking/features/alerts/domain/identity/alertFingerprint'
import type { TrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'

const CONTAINER_ID = '00000000-0000-0000-0000-000000000301'
const CONTAINER_NUMBER = 'MSCU3013010'
const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000302'

function makeActualObservation(params: {
  readonly id: string
  readonly fingerprint: string
  readonly eventTime: string
  readonly type?: Observation['type']
}): Observation {
  return {
    id: params.id,
    fingerprint: params.fingerprint,
    container_id: CONTAINER_ID,
    container_number: CONTAINER_NUMBER,
    type: params.type ?? 'LOAD',
    event_time: params.eventTime,
    event_time_type: 'ACTUAL',
    location_code: 'BRSSZ',
    location_display: 'Santos, BR',
    vessel_name: null,
    voyage: null,
    is_empty: null,
    confidence: 'high',
    provider: 'msc',
    created_from_snapshot_id: SNAPSHOT_ID,
    carrier_label: null,
    created_at: '2025-11-01T00:00:00.000Z',
    retroactive: false,
  }
}

function makeNoMovementAlert(params: {
  readonly id: string
  readonly thresholdDays: number
  readonly cycleAnchorFingerprint: string
  readonly daysWithoutMovement: number
  readonly ackedAt: string | null
}): TrackingAlert {
  return {
    id: params.id,
    container_id: CONTAINER_ID,
    category: 'monitoring',
    type: 'NO_MOVEMENT',
    severity: 'warning',
    message_key: 'alerts.noMovementDetected',
    message_params: {
      threshold_days: params.thresholdDays,
      days_without_movement: params.daysWithoutMovement,
      days: params.daysWithoutMovement,
      lastEventDate: '2025-11-01',
    },
    detected_at: '2025-11-01T00:00:00.000Z',
    triggered_at: '2025-11-01T00:00:00.000Z',
    source_observation_fingerprints: [params.cycleAnchorFingerprint],
    alert_fingerprint: computeNoMovementAlertFingerprint(
      CONTAINER_ID,
      params.thresholdDays,
      '2025-11-01',
    ),
    retroactive: false,
    provider: null,
    acked_at: params.ackedAt,
    acked_by: null,
    acked_source: params.ackedAt === null ? null : 'dashboard',
  }
}

function expectNoMovementAlert(
  alert: ReturnType<typeof deriveAlerts>[number] | undefined,
): Extract<ReturnType<typeof deriveAlerts>[number], { message_key: 'alerts.noMovementDetected' }> {
  expect(alert).toBeDefined()
  if (alert === undefined || alert.message_key !== 'alerts.noMovementDetected') {
    throw new Error('expected NO_MOVEMENT alert with alerts.noMovementDetected contract')
  }
  return alert
}

describe('no movement breakpoints', () => {
  it('emits NO_MOVEMENT(5) when 6 days pass since the last movement', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeActualObservation({
        id: 'obs-1',
        fingerprint: 'fp-cycle-1',
        eventTime: '2025-11-01T00:00:00.000Z',
      }),
    ])

    const now = new Date('2025-11-07T00:00:00.000Z')
    const alerts = deriveAlerts(timeline, 'LOADED', [], false, now)
    const noMovement = expectNoMovementAlert(alerts.find((alert) => alert.type === 'NO_MOVEMENT'))

    expect(noMovement.message_params.threshold_days).toBe(5)
    expect(noMovement.message_params.days_without_movement).toBe(6)
  })

  it('escalates to NO_MOVEMENT(10) when 11 days pass and NO_MOVEMENT(5) already exists', () => {
    const cycleAnchorFingerprint = 'fp-cycle-2'
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeActualObservation({
        id: 'obs-2',
        fingerprint: cycleAnchorFingerprint,
        eventTime: '2025-11-01T00:00:00.000Z',
      }),
    ])

    const now = new Date('2025-11-12T00:00:00.000Z')
    const existingAlerts = [
      makeNoMovementAlert({
        id: 'alert-5',
        thresholdDays: 5,
        cycleAnchorFingerprint,
        daysWithoutMovement: 6,
        ackedAt: '2025-11-08T00:00:00.000Z',
      }),
    ]

    const alerts = deriveAlerts(timeline, 'LOADED', existingAlerts, false, now)
    const noMovement = expectNoMovementAlert(alerts.find((alert) => alert.type === 'NO_MOVEMENT'))

    expect(noMovement.message_params.threshold_days).toBe(10)
    expect(noMovement.message_params.days_without_movement).toBe(11)
  })

  it('does not re-emit when NO_MOVEMENT(10) already exists at day 12', () => {
    const cycleAnchorFingerprint = 'fp-cycle-3'
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeActualObservation({
        id: 'obs-3',
        fingerprint: cycleAnchorFingerprint,
        eventTime: '2025-11-01T00:00:00.000Z',
      }),
    ])

    const now = new Date('2025-11-13T00:00:00.000Z')
    const existingAlerts = [
      makeNoMovementAlert({
        id: 'alert-5-cycle-3',
        thresholdDays: 5,
        cycleAnchorFingerprint,
        daysWithoutMovement: 5,
        ackedAt: null,
      }),
      makeNoMovementAlert({
        id: 'alert-10-cycle-3',
        thresholdDays: 10,
        cycleAnchorFingerprint,
        daysWithoutMovement: 10,
        ackedAt: '2025-11-12T00:00:00.000Z',
      }),
    ]

    const alerts = deriveAlerts(timeline, 'LOADED', existingAlerts, false, now)

    expect(alerts.find((alert) => alert.type === 'NO_MOVEMENT')).toBeUndefined()
  })

  it('resets progression after new ACTUAL movement and emits NO_MOVEMENT(5) again', () => {
    const oldCycleAnchorFingerprint = 'fp-cycle-4-old'
    const newCycleAnchorFingerprint = 'fp-cycle-4-new'
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeActualObservation({
        id: 'obs-4-old',
        fingerprint: oldCycleAnchorFingerprint,
        eventTime: '2025-11-01T00:00:00.000Z',
      }),
      makeActualObservation({
        id: 'obs-4-new',
        fingerprint: newCycleAnchorFingerprint,
        eventTime: '2025-11-15T00:00:00.000Z',
        type: 'DISCHARGE',
      }),
    ])

    const existingAlerts = [
      makeNoMovementAlert({
        id: 'alert-10-cycle-4-old',
        thresholdDays: 10,
        cycleAnchorFingerprint: oldCycleAnchorFingerprint,
        daysWithoutMovement: 11,
        ackedAt: '2025-11-12T00:00:00.000Z',
      }),
    ]

    const now = new Date('2025-11-21T00:00:00.000Z')
    const alerts = deriveAlerts(timeline, 'DISCHARGED', existingAlerts, false, now)
    const noMovement = expectNoMovementAlert(alerts.find((alert) => alert.type === 'NO_MOVEMENT'))

    expect(noMovement.message_params.threshold_days).toBe(5)
    expect(noMovement.source_observation_fingerprints).toEqual([newCycleAnchorFingerprint])
  })
})
