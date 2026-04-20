import { describe, expect, it } from 'vitest'
import {
  buildCanonicalSeriesGroups,
  type CanonicalSeriesObservation,
} from '~/modules/tracking/features/series/domain/reconcile/canonicalSeries'
import { classifySeries } from '~/modules/tracking/features/series/domain/reconcile/seriesClassification'
import {
  instantFromIsoText,
  resolveTemporalValue,
  temporalValueFromCanonical,
} from '~/shared/time/tests/helpers'

type ObservationOverrides = Omit<Partial<CanonicalSeriesObservation>, 'event_time'> & {
  readonly event_time?: string | CanonicalSeriesObservation['event_time']
}

const DEFAULT_EVENT_TIME = temporalValueFromCanonical('2026-03-28')

function makeObservation(overrides: ObservationOverrides = {}): CanonicalSeriesObservation {
  const { event_time, ...rest } = overrides

  return {
    id: overrides.id ?? 'obs-1',
    type: overrides.type ?? 'DISCHARGE',
    event_time: resolveTemporalValue(event_time, DEFAULT_EVENT_TIME),
    event_time_type: overrides.event_time_type ?? 'ACTUAL',
    location_code: overrides.location_code === undefined ? 'LKCMB' : overrides.location_code,
    location_display:
      overrides.location_display === undefined ? 'COLOMBO, LK' : overrides.location_display,
    vessel_name: overrides.vessel_name === undefined ? 'MSC ARICA' : overrides.vessel_name,
    voyage: overrides.voyage === undefined ? 'OB610R' : overrides.voyage,
    created_at: overrides.created_at ?? '2026-04-04T16:53:10.273469Z',
    ...rest,
  }
}

describe('buildCanonicalSeriesGroups', () => {
  const now = instantFromIsoText('2026-04-05T00:00:00.000Z')

  it('merges sibling discharge ACTUAL series when voyage differs but semantic anchors match', () => {
    const groups = buildCanonicalSeriesGroups(
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

    expect(groups).toHaveLength(1)
    expect(groups[0]?.observations.map((observation) => observation.id)).toEqual([
      'discharge-old',
      'discharge-new',
    ])
  })

  it('does not merge discharge ACTUAL series when location differs', () => {
    const groups = buildCanonicalSeriesGroups(
      [
        makeObservation({
          id: 'colombo',
          location_code: 'LKCMB',
          location_display: 'COLOMBO, LK',
          voyage: 'IV610A',
        }),
        makeObservation({
          id: 'singapore',
          location_code: 'SGSIN',
          location_display: 'SINGAPORE, SG',
          voyage: 'OB610R',
        }),
      ],
      now,
    )

    expect(groups).toHaveLength(2)
  })

  it('does not merge discharge ACTUAL series when vessel differs', () => {
    const groups = buildCanonicalSeriesGroups(
      [
        makeObservation({
          id: 'msc-arica',
          vessel_name: 'MSC ARICA',
          voyage: 'IV610A',
        }),
        makeObservation({
          id: 'gsl-violetta',
          vessel_name: 'GSL VIOLETTA',
          voyage: 'OB610R',
        }),
      ],
      now,
    )

    expect(groups).toHaveLength(2)
  })

  it('does not merge discharge ACTUAL series when the primary ACTUAL day differs', () => {
    const groups = buildCanonicalSeriesGroups(
      [
        makeObservation({
          id: 'march-28',
          event_time: '2026-03-28',
          voyage: 'IV610A',
        }),
        makeObservation({
          id: 'march-29',
          event_time: '2026-03-29',
          voyage: 'OB610R',
        }),
      ],
      now,
    )

    expect(groups).toHaveLength(2)
  })

  it('merges blank vs filled voyage into one series but keeps the conflict generic', () => {
    const groups = buildCanonicalSeriesGroups(
      [
        makeObservation({
          id: 'voyage-missing',
          voyage: null,
          created_at: '2026-04-02T19:12:43.853916Z',
        }),
        makeObservation({
          id: 'voyage-filled',
          voyage: 'OB610R',
          created_at: '2026-04-04T16:53:10.273469Z',
        }),
      ],
      now,
    )

    expect(groups).toHaveLength(1)

    const classification = classifySeries(groups[0]?.observations ?? [], now)
    expect(classification.conflict).toEqual({
      kind: 'MULTIPLE_ACTUALS',
      fields: [],
    })
  })
})
