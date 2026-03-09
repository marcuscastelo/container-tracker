import { describe, expect, it } from 'vitest'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import { deriveAlerts } from '~/modules/tracking/features/alerts/domain/derive/deriveAlerts'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ObservationDraft } from '~/modules/tracking/features/observation/domain/model/observationDraft'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import { normalizeMaerskSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/maersk.normalizer'
import maerskPayload from '~/modules/tracking/infrastructure/carriers/tests/fixtures/maersk/maersk_full.json'

const CONTAINER_ID = '00000000-0000-0000-0000-000000000081'
const CONTAINER_NUMBER = 'MNBU3094033'
const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000082'

type TimelineObservationSignature = {
  readonly id: string
  readonly type: Observation['type']
  readonly event_time: string | null
  readonly event_time_type: Observation['event_time_type']
  readonly location_code: string | null
  readonly location_display: string | null
  readonly vessel_name: string | null
  readonly voyage: string | null
  readonly is_empty: boolean | null
  readonly confidence: Observation['confidence']
}

function toObservation(
  draft: ObservationDraft,
  index: number,
  includeCarrierLabel: boolean,
): Observation {
  return {
    id: `obs-${index + 1}`,
    fingerprint: `fp-${index + 1}`,
    container_id: CONTAINER_ID,
    container_number: draft.container_number,
    type: draft.type,
    event_time: draft.event_time,
    event_time_type: draft.event_time_type,
    location_code: draft.location_code,
    location_display: draft.location_display,
    vessel_name: draft.vessel_name,
    voyage: draft.voyage,
    is_empty: draft.is_empty,
    confidence: draft.confidence,
    provider: draft.provider,
    created_from_snapshot_id: draft.snapshot_id,
    carrier_label: includeCarrierLabel ? (draft.carrier_label ?? null) : null,
    created_at: draft.event_time ?? `2026-02-03T15:00:0${index}.000Z`,
  }
}

function toTimelineSignature(
  observations: readonly Observation[],
): readonly TimelineObservationSignature[] {
  return observations.map((observation) => ({
    id: observation.id,
    type: observation.type,
    event_time: observation.event_time,
    event_time_type: observation.event_time_type,
    location_code: observation.location_code,
    location_display: observation.location_display,
    vessel_name: observation.vessel_name,
    voyage: observation.voyage,
    is_empty: observation.is_empty,
    confidence: observation.confidence,
  }))
}

describe('unknown-carrier event regressions', () => {
  it('does not generate automatic alerts from unknown events alone', () => {
    const now = new Date('2026-02-03T12:00:00.000Z')
    const timeline = deriveTimeline(
      CONTAINER_ID,
      CONTAINER_NUMBER,
      [
        {
          id: 'obs-unknown',
          fingerprint: 'fp-unknown',
          container_id: CONTAINER_ID,
          container_number: CONTAINER_NUMBER,
          type: 'OTHER',
          event_time: '2026-02-03T10:00:00.000Z',
          event_time_type: 'ACTUAL',
          location_code: 'BRSSZ',
          location_display: 'SANTOS, BR',
          vessel_name: null,
          voyage: null,
          is_empty: null,
          confidence: 'high',
          provider: 'maersk',
          created_from_snapshot_id: SNAPSHOT_ID,
          carrier_label: 'Carrier custom event',
          created_at: '2026-02-03T10:00:00.000Z',
        },
      ],
      now,
    )
    const status = deriveStatus(timeline)

    const alerts = deriveAlerts(timeline, status, [], false, now)
    expect(alerts).toEqual([])
  })

  it('keeps canonical fixture timeline/status/alerts unchanged when carrier_label metadata is absent', () => {
    const snapshot: Snapshot = {
      id: SNAPSHOT_ID,
      container_id: CONTAINER_ID,
      provider: 'maersk',
      fetched_at: '2026-02-03T15:00:00.000Z',
      payload: maerskPayload,
    }
    const now = new Date('2026-02-03T16:00:00.000Z')
    const drafts = normalizeMaerskSnapshot(snapshot)

    expect(drafts.length).toBeGreaterThan(0)

    const observationsWithCarrierLabel = drafts.map((draft, index) =>
      toObservation(draft, index, true),
    )
    const observationsWithoutCarrierLabel = drafts.map((draft, index) =>
      toObservation(draft, index, false),
    )

    const timelineWithCarrierLabel = deriveTimeline(
      CONTAINER_ID,
      CONTAINER_NUMBER,
      observationsWithCarrierLabel,
      now,
    )
    const timelineWithoutCarrierLabel = deriveTimeline(
      CONTAINER_ID,
      CONTAINER_NUMBER,
      observationsWithoutCarrierLabel,
      now,
    )

    expect(toTimelineSignature(timelineWithCarrierLabel.observations)).toEqual(
      toTimelineSignature(timelineWithoutCarrierLabel.observations),
    )
    expect(timelineWithCarrierLabel.holes).toEqual(timelineWithoutCarrierLabel.holes)

    const statusWithCarrierLabel = deriveStatus(timelineWithCarrierLabel)
    const statusWithoutCarrierLabel = deriveStatus(timelineWithoutCarrierLabel)
    expect(statusWithCarrierLabel).toBe(statusWithoutCarrierLabel)

    const alertsWithCarrierLabel = deriveAlerts(
      timelineWithCarrierLabel,
      statusWithCarrierLabel,
      [],
      false,
      now,
    )
    const alertsWithoutCarrierLabel = deriveAlerts(
      timelineWithoutCarrierLabel,
      statusWithoutCarrierLabel,
      [],
      false,
      now,
    )
    expect(alertsWithCarrierLabel).toEqual(alertsWithoutCarrierLabel)
  })
})
