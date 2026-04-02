import { describe, expect, it } from 'vitest'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import { normalizeMscSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/msc.normalizer'
import busanLifecycleFixture from '~/modules/tracking/infrastructure/carriers/tests/fixtures/msc/msc_phase1_busan_transshipment_lifecycle.json'
import etaTransshipmentPlannedFixture from '~/modules/tracking/infrastructure/carriers/tests/fixtures/msc/msc_phase1_eta_transshipment_planned.json'
import { instantFromIsoText } from '~/shared/time/tests/helpers'

const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000701'
const CONTAINER_ID = '00000000-0000-0000-0000-000000000702'

function makeSnapshot(payload: unknown): Snapshot {
  return {
    id: SNAPSHOT_ID,
    container_id: CONTAINER_ID,
    provider: 'msc',
    fetched_at: '2026-04-20T12:00:00.000Z',
    payload,
  }
}

function toObservation(
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
    created_at: `2026-04-20T12:00:${String(index).padStart(2, '0')}.000Z`,
  }
}

describe('MSC phase 1 semantic mapping', () => {
  it('maps ETA/ETD and intended transshipment labels with forced EXPECTED semantics', () => {
    const drafts = normalizeMscSnapshot(makeSnapshot(etaTransshipmentPlannedFixture))

    expect(drafts.map((draft) => draft.type)).toEqual([
      'GATE_OUT',
      'GATE_IN',
      'DEPARTURE',
      'ARRIVAL',
      'TRANSSHIPMENT_INTENDED',
      'ARRIVAL',
      'TRANSSHIPMENT_INTENDED',
      'ARRIVAL',
    ])

    const etd = drafts.find((draft) => draft.carrier_label === 'Estimated Time of Departure')
    expect(etd?.type).toBe('DEPARTURE')
    expect(etd?.event_time_type).toBe('EXPECTED')
    expect(etd?.confidence).toBe('medium')
    expect(etd?.vessel_name).toBe('MSC MIRAYA V')
    expect(etd?.voyage).toBe('OB612R')

    const santosEta = drafts.find(
      (draft) =>
        draft.carrier_label === 'Estimated Time of Arrival' &&
        draft.location_display === 'SANTOS, BR',
    )
    expect(santosEta?.type).toBe('ARRIVAL')
    expect(santosEta?.event_time_type).toBe('EXPECTED')
    expect(santosEta?.vessel_name).toBeNull()

    const intendedDrafts = drafts.filter(
      (draft) => draft.carrier_label === 'Full Intended Transshipment',
    )
    expect(intendedDrafts).toHaveLength(2)
    expect(intendedDrafts.every((draft) => draft.type === 'TRANSSHIPMENT_INTENDED')).toBe(true)
    expect(intendedDrafts.every((draft) => draft.event_time_type === 'EXPECTED')).toBe(true)
    expect(intendedDrafts.every((draft) => draft.vessel_name === null)).toBe(true)
    expect(intendedDrafts.every((draft) => draft.voyage === null)).toBe(true)
  })

  it('skips synthetic PodEtaDate arrival when the MSC feed already exposes an explicit arrival ETA', () => {
    const drafts = normalizeMscSnapshot(makeSnapshot(etaTransshipmentPlannedFixture))

    const santosEtaDrafts = drafts.filter(
      (draft) => draft.type === 'ARRIVAL' && draft.location_display === 'SANTOS, BR',
    )

    expect(santosEtaDrafts).toHaveLength(1)
    expect(santosEtaDrafts[0]?.carrier_label).toBe('Estimated Time of Arrival')
  })

  it('maps Busan lifecycle events conservatively while keeping strong load/discharge facts', () => {
    const drafts = normalizeMscSnapshot(makeSnapshot(busanLifecycleFixture))

    expect(drafts.map((draft) => draft.type)).toEqual([
      'GATE_IN',
      'LOAD',
      'DISCHARGE',
      'TRANSSHIPMENT_POSITIONED_IN',
      'LOAD',
      'ARRIVAL',
    ])

    const discharge = drafts.find(
      (draft) => draft.carrier_label === 'Full Transshipment Discharged',
    )
    expect(discharge?.type).toBe('DISCHARGE')
    expect(discharge?.event_time_type).toBe('ACTUAL')
    expect(discharge?.vessel_name).toBe('MSC IRIS')

    const positionedIn = drafts.find(
      (draft) => draft.carrier_label === 'Full Transshipment Positioned In',
    )
    expect(positionedIn?.type).toBe('TRANSSHIPMENT_POSITIONED_IN')
    expect(positionedIn?.event_time_type).toBe('ACTUAL')
    expect(positionedIn?.confidence).toBe('high')
    expect(positionedIn?.vessel_name).toBeNull()
    expect(positionedIn?.voyage).toBeNull()

    const reload = drafts.find((draft) => draft.carrier_label === 'Full Transshipment Loaded')
    expect(reload?.type).toBe('LOAD')
    expect(reload?.event_time_type).toBe('ACTUAL')
    expect(reload?.vessel_name).toBe('MSC BIANCA SILVIA')
    expect(reload?.voyage).toBe('UX605A')
  })

  it('keeps the Busan lifecycle derived status on the strong factual leg state', () => {
    const drafts = normalizeMscSnapshot(makeSnapshot(busanLifecycleFixture))
    const observations = drafts.map(toObservation)

    const timeline = deriveTimeline(
      CONTAINER_ID,
      'MSDU1652364',
      observations,
      instantFromIsoText('2026-05-12T12:00:00.000Z'),
    )

    expect(deriveStatus(timeline)).toBe('LOADED')
  })
})
