import { describe, expect, it } from 'vitest'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import { normalizeCmaCgmSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/cmacgm.normalizer'
import transshipmentTangaMombasaMyny from '~/modules/tracking/infrastructure/carriers/tests/fixtures/cmacgm/cmacgm_transshipment_tanga_mombasa_myny.json'
import {
  assertNoTransshipmentSemanticViolations,
  collectTransshipmentSemanticViolations,
} from '~/modules/tracking/infrastructure/carriers/tests/helpers/transshipmentSemanticAudit'

const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000711'
const CONTAINER_ID = '00000000-0000-0000-0000-000000000712'
const CONTAINER_NUMBER = 'TCLU3923661'

function makeSnapshot(payload: unknown): Snapshot {
  return {
    id: SNAPSHOT_ID,
    container_id: CONTAINER_ID,
    provider: 'cmacgm',
    fetched_at: '2026-03-12T11:00:00.000Z',
    payload,
  }
}

function toDomainObservation(
  draft: ReturnType<typeof normalizeCmaCgmSnapshot>[number],
  index: number,
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
    carrier_label: draft.carrier_label ?? null,
    created_at: draft.event_time ?? `2026-03-12T11:00:0${index}.000Z`,
  }
}

function deriveRegressionTimelineAndStatus(forcedStatus?: ContainerStatus) {
  const drafts = normalizeCmaCgmSnapshot(makeSnapshot(transshipmentTangaMombasaMyny))
  const observations = drafts.map((draft, index) => toDomainObservation(draft, index))
  const timeline = deriveTimeline(
    CONTAINER_ID,
    CONTAINER_NUMBER,
    observations,
    new Date('2026-03-12T12:00:00.000Z'),
  )
  const status = forcedStatus ?? deriveStatus(timeline)
  return { timeline, status }
}

describe('CMA-CGM transshipment semantic audit helper', () => {
  it('passes for canonical post-transshipment status', () => {
    const { timeline, status } = deriveRegressionTimelineAndStatus()

    expect(status).toBe('LOADED')
    expect(() => assertNoTransshipmentSemanticViolations(timeline, status)).not.toThrow()
  })

  it('flags arrival-like status when there is a later ACTUAL LOAD', () => {
    const { timeline } = deriveRegressionTimelineAndStatus('ARRIVED_AT_POD')
    const violations = collectTransshipmentSemanticViolations(timeline, 'ARRIVED_AT_POD')

    expect(violations.map((violation) => violation.code)).toEqual([
      'latest_actual_load_with_arrival_like_status',
      'onboard_vessel_with_arrival_like_status',
      'post_transshipment_load_ignored',
    ])
  })
})
