import { describe, expect, it } from 'vitest'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import { normalizeCmaCgmSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/cmacgm.normalizer'
import transshipmentTangaMombasaMyny from '~/modules/tracking/infrastructure/carriers/tests/fixtures/cmacgm/cmacgm_transshipment_tanga_mombasa_myny.json'

const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000701'
const CONTAINER_ID = '00000000-0000-0000-0000-000000000702'

function makeSnapshot(payload: unknown): Snapshot {
  return {
    id: SNAPSHOT_ID,
    container_id: CONTAINER_ID,
    provider: 'cmacgm',
    fetched_at: '2026-03-12T09:00:00.000Z',
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
    created_at: draft.event_time ?? `2026-03-12T09:00:0${index}.000Z`,
  }
}

describe('CMA-CGM real transshipment regression fixture', () => {
  it('normalizes the real TANGA -> MOMBASA -> MYNY sequence deterministically', () => {
    const drafts = normalizeCmaCgmSnapshot(makeSnapshot(transshipmentTangaMombasaMyny))

    expect(drafts).toHaveLength(5)
    expect(drafts.map((draft) => draft.type)).toEqual([
      'GATE_IN',
      'LOAD',
      'ARRIVAL',
      'DISCHARGE',
      'LOAD',
    ])

    expect(drafts[1]?.vessel_name).toBe('ALPHA KIRAWIRA')
    expect(drafts[1]?.voyage).toBe('428V8S')
    expect(drafts[4]?.vessel_name).toBe('MYNY')
    expect(drafts[4]?.voyage).toBe('0K126E1MA')
  })

  it('keeps post-transshipment LOAD as dominant movement for current status', () => {
    const drafts = normalizeCmaCgmSnapshot(makeSnapshot(transshipmentTangaMombasaMyny))
    const observations = drafts.map((draft, index) => toDomainObservation(draft, index))

    const timeline = deriveTimeline(
      CONTAINER_ID,
      'TCLU3923661',
      observations,
      new Date('2026-03-12T12:00:00.000Z'),
    )
    const actualObservations = timeline.observations.filter((observation) => {
      return observation.event_time_type === 'ACTUAL'
    })
    const latestActual = actualObservations[actualObservations.length - 1]
    const status = deriveStatus(timeline)

    expect(latestActual?.type).toBe('LOAD')
    expect(latestActual?.vessel_name).toBe('MYNY')
    expect(status).toBe('LOADED')
    expect(status).not.toBe('ARRIVED_AT_POD')
  })
})
