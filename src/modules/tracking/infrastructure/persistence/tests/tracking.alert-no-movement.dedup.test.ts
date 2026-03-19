import { describe, expect, it } from 'vitest'
import { deriveAlerts } from '~/modules/tracking/features/alerts/domain/derive/deriveAlerts'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import { alertToInsertRow } from '~/modules/tracking/infrastructure/persistence/tracking.alert.persistence.mappers'
import {
  toNoMovementDedupKeysFromAlert,
  toNoMovementDedupKeysFromRow,
} from '~/modules/tracking/infrastructure/persistence/tracking.alert-no-movement.dedup'
import { instantFromIsoText, temporalValueFromCanonical } from '~/shared/time/tests/helpers'

const CONTAINER_ID = '00000000-0000-0000-0000-000000000401'
const CONTAINER_NUMBER = 'MSCU4014010'
const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000402'

function makeActualObservation(params: {
  readonly id: string
  readonly fingerprint: string
  readonly eventTime: string
}): Observation {
  return {
    id: params.id,
    fingerprint: params.fingerprint,
    container_id: CONTAINER_ID,
    container_number: CONTAINER_NUMBER,
    type: 'LOAD',
    event_time: temporalValueFromCanonical(params.eventTime),
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

describe('NO_MOVEMENT dedup policy alignment', () => {
  it('keeps derivation, persistence mapping, and dedup keys aligned on the canonical breakpoint', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeActualObservation({
        id: 'obs-1',
        fingerprint: 'fp-cycle-1',
        eventTime: '2025-11-01T00:00:00.000Z',
      }),
    ])

    const alerts = deriveAlerts(
      timeline,
      'LOADED',
      [],
      false,
      instantFromIsoText('2025-11-08T00:00:00.000Z'),
    )
    const noMovement = alerts.find((alert) => alert.type === 'NO_MOVEMENT')

    expect(noMovement).toBeDefined()
    if (
      noMovement === undefined ||
      noMovement.type !== 'NO_MOVEMENT' ||
      noMovement.message_key !== 'alerts.noMovementDetected'
    ) {
      throw new Error('expected derived NO_MOVEMENT alert')
    }

    expect(noMovement.message_params.threshold_days).toBe(5)

    const row = alertToInsertRow(noMovement)
    const dedupRow = {
      container_id: noMovement.container_id,
      category: noMovement.category,
      type: noMovement.type,
      message_key: noMovement.message_key,
      message_params: row.message_params,
      source_observation_fingerprints: row.source_observation_fingerprints,
    }

    expect(row.message_params).toEqual(noMovement.message_params)
    expect(toNoMovementDedupKeysFromAlert(noMovement)).toEqual(
      toNoMovementDedupKeysFromRow(dedupRow),
    )
    expect(toNoMovementDedupKeysFromAlert(noMovement)).toEqual([
      `${CONTAINER_ID}|date:2025-11-01|threshold:5`,
      `${CONTAINER_ID}|source:fp-cycle-1|threshold:5`,
    ])
  })
})
