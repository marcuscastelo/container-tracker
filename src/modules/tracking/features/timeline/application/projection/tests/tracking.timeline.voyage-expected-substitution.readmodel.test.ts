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

const DEFAULT_EVENT_TIME = temporalValueFromCanonical('2026-05-17')

function makeObservation(overrides: ObservationOverrides = {}): TrackingObservationProjection {
  const { event_time, ...rest } = overrides

  return {
    id: overrides.id ?? 'obs-1',
    type: overrides.type ?? 'ARRIVAL',
    carrier_label: overrides.carrier_label ?? null,
    event_time: resolveTemporalValue(event_time, DEFAULT_EVENT_TIME),
    event_time_type: overrides.event_time_type ?? 'EXPECTED',
    location_code: overrides.location_code ?? 'BRSSZ',
    location_display: overrides.location_display ?? 'SANTOS, BR',
    vessel_name: overrides.vessel_name ?? null,
    voyage: overrides.voyage ?? null,
    created_at: overrides.created_at ?? '2026-04-01T00:00:00.000Z',
    ...rest,
  }
}

function requireTimelineItem(
  timeline: ReturnType<typeof deriveTimelineWithSeriesReadModel>,
  id: string,
) {
  const item = timeline.find((entry) => entry.id === id)
  if (item === undefined) {
    throw new Error(`Expected timeline item ${id}`)
  }

  return item
}

describe('deriveTimelineWithSeriesReadModel voyage expected substitution', () => {
  const now = instantFromIsoText('2026-04-06T00:00:00.000Z')

  it('suppresses an older generic final arrival when a newer vessel-backed chain exists', () => {
    const timeline = deriveTimelineWithSeriesReadModel(
      [
        makeObservation({
          id: 'final-generic-old',
          type: 'ARRIVAL',
          event_time: '2026-05-17',
          location_code: 'BRSSZ',
          location_display: 'SANTOS, BR',
          created_at: '2026-04-02T00:00:00.000Z',
        }),
        makeObservation({
          id: 'departure-leg',
          type: 'DEPARTURE',
          event_time: '2026-04-07',
          location_code: 'PKBQM',
          location_display: 'KARACHI, PK',
          vessel_name: 'SAO PAULO EXPRESS',
          voyage: '2613W',
          created_at: '2026-04-05T00:00:00.000Z',
        }),
        makeObservation({
          id: 'singapore-intended',
          type: 'TRANSSHIPMENT_INTENDED',
          event_time: '2026-04-23',
          location_code: 'SGSIN',
          location_display: 'SINGAPORE, SG',
          created_at: '2026-04-05T00:00:00.000Z',
        }),
        makeObservation({
          id: 'final-specific-new',
          type: 'ARRIVAL',
          event_time: '2026-05-15',
          location_code: 'BRSSZ',
          location_display: 'SANTOS, BR',
          vessel_name: 'SAO PAULO EXPRESS',
          voyage: '2613W',
          created_at: '2026-04-05T00:00:00.000Z',
        }),
      ],
      now,
    )

    expect(timeline.map((item) => item.id)).not.toContain('final-generic-old')
    const promoted = requireTimelineItem(timeline, 'final-specific-new')
    expect(promoted.hasSeriesHistory).toBe(true)
    expect(promoted.seriesHistory?.classified.map((item) => [item.id, item.seriesLabel])).toEqual([
      ['final-specific-new', 'ACTIVE'],
      ['final-generic-old', 'SUPERSEDED_EXPECTED'],
    ])
  })

  it('suppresses a generic final arrival even when both terminal expecteds share the same created_at', () => {
    const timeline = deriveTimelineWithSeriesReadModel(
      [
        makeObservation({
          id: 'final-generic-same-created-at',
          type: 'ARRIVAL',
          event_time: '2026-05-20',
          location_code: 'BRSSZ',
          location_display: 'SANTOS, BR',
          created_at: '2026-04-05T00:00:00.000Z',
        }),
        makeObservation({
          id: 'singapore-intended',
          type: 'TRANSSHIPMENT_INTENDED',
          event_time: '2026-04-23',
          location_code: 'SGSIN',
          location_display: 'SINGAPORE, SG',
          created_at: '2026-04-05T00:00:00.000Z',
        }),
        makeObservation({
          id: 'final-specific-same-created-at',
          type: 'ARRIVAL',
          event_time: '2026-05-15',
          location_code: 'BRSSZ',
          location_display: 'SANTOS, BR',
          vessel_name: 'SAO PAULO EXPRESS',
          voyage: '2613W',
          created_at: '2026-04-05T00:00:00.000Z',
        }),
      ],
      now,
    )

    expect(timeline.map((item) => item.id)).not.toContain('final-generic-same-created-at')

    const promoted = requireTimelineItem(timeline, 'final-specific-same-created-at')
    expect(promoted.hasSeriesHistory).toBe(true)
    expect(promoted.seriesHistory?.classified.map((item) => [item.id, item.seriesLabel])).toEqual([
      ['final-specific-same-created-at', 'ACTIVE'],
      ['final-generic-same-created-at', 'SUPERSEDED_EXPECTED'],
    ])
  })

  it('collapses final expected duplication when a full future voyage chain points to the same port', () => {
    const timeline = deriveTimelineWithSeriesReadModel(
      [
        makeObservation({
          id: 'final-generic-old',
          type: 'ARRIVAL',
          event_time: '2026-05-20',
          location_code: 'BRSSZ',
          location_display: 'SANTOS, BR',
          created_at: '2026-04-01T00:00:00.000Z',
        }),
        makeObservation({
          id: 'colombo-intended',
          type: 'TRANSSHIPMENT_INTENDED',
          event_time: '2026-04-13',
          location_code: 'LKCMB',
          location_display: 'COLOMBO, LK',
          created_at: '2026-04-05T00:00:00.000Z',
        }),
        makeObservation({
          id: 'singapore-arrival',
          type: 'ARRIVAL',
          event_time: '2026-04-18',
          location_code: 'SGSIN',
          location_display: 'SINGAPORE, SG',
          vessel_name: 'SAO PAULO EXPRESS',
          voyage: '2613W',
          created_at: '2026-04-05T00:00:00.000Z',
        }),
        makeObservation({
          id: 'singapore-intended',
          type: 'TRANSSHIPMENT_INTENDED',
          event_time: '2026-04-23',
          location_code: 'SGSIN',
          location_display: 'SINGAPORE, SG',
          created_at: '2026-04-05T00:00:00.000Z',
        }),
        makeObservation({
          id: 'final-specific-new',
          type: 'ARRIVAL',
          event_time: '2026-05-15',
          location_code: 'BRSSZ',
          location_display: 'SANTOS, BR',
          vessel_name: 'SAO PAULO EXPRESS',
          voyage: '2613W',
          created_at: '2026-04-05T00:00:00.000Z',
        }),
      ],
      now,
    )

    const santosExpectedArrivals = timeline.filter(
      (item) =>
        item.type === 'ARRIVAL' &&
        item.eventTimeType === 'EXPECTED' &&
        item.location === 'SANTOS, BR',
    )

    expect(santosExpectedArrivals.map((item) => item.id)).toEqual(['final-specific-new'])
  })

  it('keeps simple expected variants visible when no supporting future chain exists', () => {
    const timeline = deriveTimelineWithSeriesReadModel(
      [
        makeObservation({
          id: 'final-generic-old',
          type: 'ARRIVAL',
          event_time: '2026-05-17',
          location_code: 'BRSSZ',
          location_display: 'SANTOS, BR',
          created_at: '2026-04-02T00:00:00.000Z',
        }),
        makeObservation({
          id: 'final-specific-isolated',
          type: 'ARRIVAL',
          event_time: '2026-05-15',
          location_code: 'BRSSZ',
          location_display: 'SANTOS, BR',
          vessel_name: 'SAO PAULO EXPRESS',
          voyage: '2613W',
          created_at: '2026-04-05T00:00:00.000Z',
        }),
      ],
      now,
    )

    expect(timeline.map((item) => item.id)).toEqual([
      'final-specific-isolated',
      'final-generic-old',
    ])
  })

  it('keeps ACTUAL as the winning primary when it exists in the series', () => {
    const timeline = deriveTimelineWithSeriesReadModel(
      [
        makeObservation({
          id: 'arrival-expected',
          type: 'ARRIVAL',
          event_time: '2026-05-15',
          location_code: 'BRSSZ',
          location_display: 'SANTOS, BR',
          vessel_name: 'SAO PAULO EXPRESS',
          voyage: '2613W',
          created_at: '2026-04-05T00:00:00.000Z',
        }),
        makeObservation({
          id: 'arrival-actual',
          type: 'ARRIVAL',
          event_time: '2026-05-14',
          event_time_type: 'ACTUAL',
          location_code: 'BRSSZ',
          location_display: 'SANTOS, BR',
          vessel_name: 'SAO PAULO EXPRESS',
          voyage: '2613W',
          created_at: '2026-05-14T12:00:00.000Z',
        }),
      ],
      instantFromIsoText('2026-05-16T00:00:00.000Z'),
    )

    expect(timeline).toHaveLength(1)
    expect(timeline[0]?.id).toBe('arrival-actual')
    expect(timeline[0]?.eventTimeType).toBe('ACTUAL')
    expect(
      timeline[0]?.seriesHistory?.classified.map((item) => [item.id, item.seriesLabel]),
    ).toEqual([
      ['arrival-actual', 'CONFIRMED'],
      ['arrival-expected', 'REDUNDANT_AFTER_ACTUAL'],
    ])
  })

  it('keeps lazy history affordance when cross-series substitution happens without embedded history', () => {
    const timeline = deriveTimelineWithSeriesReadModel(
      [
        makeObservation({
          id: 'final-generic-old',
          type: 'ARRIVAL',
          event_time: '2026-05-17',
          location_code: 'BRSSZ',
          location_display: 'SANTOS, BR',
          created_at: '2026-04-02T00:00:00.000Z',
        }),
        makeObservation({
          id: 'singapore-intended',
          type: 'TRANSSHIPMENT_INTENDED',
          event_time: '2026-04-23',
          location_code: 'SGSIN',
          location_display: 'SINGAPORE, SG',
          created_at: '2026-04-05T00:00:00.000Z',
        }),
        makeObservation({
          id: 'final-specific-new',
          type: 'ARRIVAL',
          event_time: '2026-05-15',
          location_code: 'BRSSZ',
          location_display: 'SANTOS, BR',
          vessel_name: 'SAO PAULO EXPRESS',
          voyage: '2613W',
          created_at: '2026-04-05T00:00:00.000Z',
        }),
      ],
      now,
      { includeSeriesHistory: false },
    )

    const promoted = requireTimelineItem(timeline, 'final-specific-new')
    expect(promoted.hasSeriesHistory).toBe(true)
    expect(promoted.seriesHistory).toBeUndefined()
  })
})
