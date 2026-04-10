import { describe, expect, it } from 'vitest'
import type { TrackingObservationProjection } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import { deriveTimelineWithSeriesReadModel } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import {
  instantFromIsoText,
  resolveTemporalValue,
  temporalValueFromCanonical,
} from '~/shared/time/tests/helpers'

type ObservationOverrides = Omit<Partial<TrackingObservationProjection>, 'event_time'> & {
  readonly event_time?: string | TrackingObservationProjection['event_time']
}

const DEFAULT_EVENT_TIME = temporalValueFromCanonical('2026-03-28')

function makeObservation(overrides: ObservationOverrides = {}): TrackingObservationProjection {
  const { event_time, ...rest } = overrides

  return {
    id: overrides.id ?? 'obs-1',
    type: overrides.type ?? 'DISCHARGE',
    carrier_label: overrides.carrier_label ?? null,
    event_time: resolveTemporalValue(event_time, DEFAULT_EVENT_TIME),
    event_time_type: overrides.event_time_type ?? 'ACTUAL',
    location_code: overrides.location_code ?? 'LKCMB',
    location_display: overrides.location_display ?? 'COLOMBO, LK',
    vessel_name: overrides.vessel_name === undefined ? 'MSC ARICA' : overrides.vessel_name,
    voyage: overrides.voyage === undefined ? 'OB610R' : overrides.voyage,
    created_at: overrides.created_at ?? '2026-04-04T16:53:10.273469Z',
    ...rest,
  }
}

describe('deriveTimelineWithSeriesReadModel actual voyage conflicts', () => {
  const now = instantFromIsoText('2026-04-05T00:00:00.000Z')

  it('keeps a single canonical DISCHARGE item when sibling ACTUAL series differ only by voyage', () => {
    const timeline = deriveTimelineWithSeriesReadModel(
      [
        makeObservation({
          id: 'discharge-old',
          voyage: 'IV610A',
          created_at: '2026-04-02T19:12:43.853916Z',
        }),
        makeObservation({
          id: 'discharge-new',
          voyage: 'OB610R',
          created_at: '2026-04-04T16:53:10.273469Z',
        }),
      ],
      now,
    )

    expect(timeline).toHaveLength(1)
    expect(timeline[0]?.id).toBe('discharge-new')
    expect(timeline[0]?.seriesConflict).toEqual({
      kind: 'VOYAGE_MISMATCH_AFTER_ACTUAL_CONFIRMATION',
      fields: ['voyage'],
    })
    expect(
      timeline[0]?.seriesHistory?.classified.map((item) => ({
        id: item.id,
        voyage: item.voyage,
        changeKind: item.changeKind,
      })),
    ).toEqual([
      {
        id: 'discharge-old',
        voyage: 'IV610A',
        changeKind: 'VOYAGE_CORRECTED_AFTER_CONFIRMATION',
      },
      {
        id: 'discharge-new',
        voyage: 'OB610R',
        changeKind: null,
      },
    ])
  })

  it('keeps conflict metadata on the primary timeline item even without embedded history', () => {
    const timeline = deriveTimelineWithSeriesReadModel(
      [
        makeObservation({
          id: 'discharge-old',
          voyage: 'IV610A',
          created_at: '2026-04-02T19:12:43.853916Z',
        }),
        makeObservation({
          id: 'discharge-new',
          voyage: 'OB610R',
          created_at: '2026-04-04T16:53:10.273469Z',
        }),
      ],
      now,
      { includeSeriesHistory: false },
    )

    expect(timeline[0]?.seriesHistory).toBeUndefined()
    expect(timeline[0]?.hasSeriesHistory).toBe(true)
    expect(timeline[0]?.seriesConflict?.kind).toBe('VOYAGE_MISMATCH_AFTER_ACTUAL_CONFIRMATION')
  })
})
