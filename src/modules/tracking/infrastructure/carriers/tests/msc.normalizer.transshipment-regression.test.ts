import { describe, expect, it } from 'vitest'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import { normalizeMscSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/msc.normalizer'
import mscTransshipment0312Regression from '~/modules/tracking/infrastructure/carriers/tests/fixtures/msc/msc_transshipment_0312_regression.json'

const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000641'
const CONTAINER_ID = '00000000-0000-0000-0000-000000000642'
const CONTAINER_NUMBER = 'MSDU1652364'

function makeSnapshot(payload: unknown): Snapshot {
  return {
    id: SNAPSHOT_ID,
    container_id: CONTAINER_ID,
    provider: 'msc',
    fetched_at: '2026-03-12T08:50:53.461Z',
    payload,
  }
}

function toDomainObservation(
  draft: ReturnType<typeof normalizeMscSnapshot>[number],
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
    created_at: draft.event_time ?? `2026-03-12T08:50:5${index}.000Z`,
  }
}

describe('MSC transshipment regression (0312)', () => {
  it('normalizes the real feed sequence without semantic corruption', () => {
    const snapshot = makeSnapshot(mscTransshipment0312Regression)
    const drafts = normalizeMscSnapshot(snapshot)

    expect(drafts).toHaveLength(8)
    expect(drafts.map((draft) => draft.type)).toEqual([
      'GATE_OUT',
      'GATE_IN',
      'LOAD',
      'DISCHARGE',
      'TERMINAL_MOVE',
      'TERMINAL_MOVE',
      'LOAD',
      'ARRIVAL',
    ])

    const etaDraft = drafts[7]
    expect(etaDraft?.type).toBe('ARRIVAL')
    expect(etaDraft?.event_time_type).toBe('EXPECTED')

    const positionedDrafts = drafts.filter((draft) => draft.carrier_label?.includes('Positioned'))
    expect(positionedDrafts).toHaveLength(2)
    expect(positionedDrafts.map((draft) => draft.type)).toEqual(['TERMINAL_MOVE', 'TERMINAL_MOVE'])

    const invalidVesselNames = drafts.filter(
      (draft) => draft.vessel_name === 'LADEN' || draft.vessel_name === 'EMPTY',
    )
    expect(invalidVesselNames).toHaveLength(0)
  })

  it('keeps current derived status as LOADED for the real MSC sequence', () => {
    const drafts = normalizeMscSnapshot(makeSnapshot(mscTransshipment0312Regression))
    const observations = drafts.map((draft, index) => toDomainObservation(draft, index))

    const timeline = deriveTimeline(
      CONTAINER_ID,
      CONTAINER_NUMBER,
      observations,
      new Date('2026-03-12T12:00:00.000Z'),
    )
    const status = deriveStatus(timeline)

    expect(status).toBe('LOADED')
  })

  it.todo('should derive IN_TRANSIT for real MSC transshipment feed without explicit DEPARTURE')
})
