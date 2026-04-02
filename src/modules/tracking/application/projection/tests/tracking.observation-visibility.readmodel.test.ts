import { describe, expect, it } from 'vitest'
import { suppressSupersededObservationsForProjection } from '~/modules/tracking/application/projection/tracking.observation-visibility.readmodel'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { temporalValueFromCanonical } from '~/shared/time/tests/helpers'

function makeObservation(overrides: Partial<Observation>): Observation {
  return {
    id: overrides.id ?? 'obs-1',
    fingerprint: overrides.fingerprint ?? 'fp-1',
    container_id: overrides.container_id ?? 'container-1',
    container_number: overrides.container_number ?? 'MSDU1976635',
    type: overrides.type ?? 'OTHER',
    event_time:
      overrides.event_time === undefined
        ? temporalValueFromCanonical('2026-05-15')
        : overrides.event_time,
    event_time_type: overrides.event_time_type ?? 'EXPECTED',
    location_code: overrides.location_code ?? 'BRSSZ',
    location_display: overrides.location_display ?? 'SANTOS, BR',
    vessel_name: overrides.vessel_name ?? null,
    voyage: overrides.voyage ?? null,
    is_empty: overrides.is_empty ?? null,
    confidence: overrides.confidence ?? 'medium',
    provider: overrides.provider ?? 'msc',
    created_from_snapshot_id: overrides.created_from_snapshot_id ?? 'snapshot-1',
    carrier_label: overrides.carrier_label ?? 'Estimated Time of Arrival',
    created_at: overrides.created_at ?? '2026-04-20T12:00:00.000Z',
    retroactive: overrides.retroactive ?? false,
  }
}

describe('suppressSupersededObservationsForProjection', () => {
  it('suppresses legacy OTHER when a richer mapped observation exists for the same MSC event', () => {
    const legacyOther = makeObservation({
      id: 'legacy-other',
      fingerprint: 'fp-other',
      type: 'OTHER',
      created_from_snapshot_id: 'snapshot-legacy',
    })
    const mappedArrival = makeObservation({
      id: 'mapped-arrival',
      fingerprint: 'fp-arrival',
      type: 'ARRIVAL',
      created_from_snapshot_id: 'snapshot-remapped',
    })

    const visible = suppressSupersededObservationsForProjection([legacyOther, mappedArrival])

    expect(visible).toEqual([mappedArrival])
  })

  it('suppresses legacy TERMINAL_MOVE when it is superseded by positioned helper semantics', () => {
    const legacyTerminalMove = makeObservation({
      id: 'legacy-terminal',
      fingerprint: 'fp-terminal',
      type: 'TERMINAL_MOVE',
      carrier_label: 'Full Transshipment Positioned In',
      location_code: 'KRPUS',
      location_display: 'BUSAN, KR',
      event_time: temporalValueFromCanonical('2026-05-02'),
      created_from_snapshot_id: 'snapshot-legacy',
    })
    const positionedIn = makeObservation({
      id: 'positioned-in',
      fingerprint: 'fp-positioned-in',
      type: 'TRANSSHIPMENT_POSITIONED_IN',
      carrier_label: 'Full Transshipment Positioned In',
      location_code: 'KRPUS',
      location_display: 'BUSAN, KR',
      event_time: temporalValueFromCanonical('2026-05-02'),
      created_from_snapshot_id: 'snapshot-remapped',
    })

    const visible = suppressSupersededObservationsForProjection([legacyTerminalMove, positionedIn])

    expect(visible).toEqual([positionedIn])
  })

  it('keeps unrelated OTHER observations visible', () => {
    const other = makeObservation({
      id: 'other',
      fingerprint: 'fp-other',
      type: 'OTHER',
      carrier_label: 'Carrier Custom Event',
    })
    const mappedArrival = makeObservation({
      id: 'mapped-arrival',
      fingerprint: 'fp-arrival',
      type: 'ARRIVAL',
      carrier_label: 'Estimated Time of Arrival',
    })

    const visible = suppressSupersededObservationsForProjection([other, mappedArrival])

    expect(visible).toEqual([other, mappedArrival])
  })
})
