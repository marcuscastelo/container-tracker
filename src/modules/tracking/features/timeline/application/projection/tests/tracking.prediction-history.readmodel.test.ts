import { describe, expect, it } from 'vitest'
import type { TrackingObservationProjection } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import {
  buildTrackingPredictionHistoryReadModel,
  type TrackingPredictionHistoryReadModel,
} from '~/modules/tracking/features/timeline/application/projection/tracking.prediction-history.readmodel'
import { deriveTimelineWithSeriesReadModel } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import {
  instantFromIsoText,
  resolveTemporalValue,
  temporalValueFromCanonical,
} from '~/shared/time/tests/helpers'

type ObservationOverrides = Omit<Partial<TrackingObservationProjection>, 'event_time'> & {
  readonly event_time?: string | TrackingObservationProjection['event_time']
}

const DEFAULT_EVENT_TIME = temporalValueFromCanonical('2026-05-10')

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

function requirePredictionHistory(
  observations: readonly TrackingObservationProjection[],
  timelineItemId: string,
  now: string,
): TrackingPredictionHistoryReadModel {
  const timeline = deriveTimelineWithSeriesReadModel(observations, instantFromIsoText(now))
  const item = timeline.find((entry) => entry.id === timelineItemId)

  if (item?.seriesHistory === undefined) {
    throw new Error(`Expected series history for timeline item ${timelineItemId}`)
  }

  const predictionHistory = buildTrackingPredictionHistoryReadModel(item.seriesHistory)
  if (predictionHistory === null) {
    throw new Error(`Expected prediction history for timeline item ${timelineItemId}`)
  }

  return predictionHistory
}

describe('buildTrackingPredictionHistoryReadModel', () => {
  it('aggregates repeated identical observations into a single version with observed-at metadata', () => {
    const predictionHistory = requirePredictionHistory(
      [
        makeObservation({
          id: 'eta-v1-a',
          event_time: '2026-05-10',
          created_at: '2026-04-01T00:00:00.000Z',
        }),
        makeObservation({
          id: 'eta-v1-b',
          event_time: '2026-05-10',
          created_at: '2026-04-02T00:00:00.000Z',
        }),
        makeObservation({
          id: 'eta-v1-c',
          event_time: '2026-05-10',
          created_at: '2026-04-03T00:00:00.000Z',
        }),
      ],
      'eta-v1-c',
      '2026-04-05T00:00:00.000Z',
    )

    expect(predictionHistory.header).toEqual({
      tone: 'neutral',
      summary_kind: 'SINGLE_VERSION',
      current_version_id: 'eta-v1-c',
      previous_version_id: null,
      original_version_id: null,
      reason_kind: null,
    })
    expect(predictionHistory.versions).toEqual([
      {
        id: 'eta-v1-c',
        is_current: true,
        type: 'ARRIVAL',
        event_time: { kind: 'date', value: '2026-05-10', timezone: null },
        event_time_type: 'EXPECTED',
        vessel_name: null,
        voyage: null,
        version_state: 'INITIAL',
        explanatory_text_kind: null,
        transition_kind_from_previous_version: null,
        observed_at_count: 3,
        observed_at_list: [
          '2026-04-01T00:00:00.000Z',
          '2026-04-02T00:00:00.000Z',
          '2026-04-03T00:00:00.000Z',
        ],
        first_observed_at: '2026-04-01T00:00:00.000Z',
        last_observed_at: '2026-04-03T00:00:00.000Z',
      },
    ])
  })

  it('keeps ETA revisions current-first and labels non-conflicting expected changes as estimate changes', () => {
    const predictionHistory = requirePredictionHistory(
      [
        makeObservation({
          id: 'eta-10',
          event_time: '2026-05-10',
          created_at: '2026-04-01T00:00:00.000Z',
        }),
        makeObservation({
          id: 'eta-12',
          event_time: '2026-05-12',
          created_at: '2026-04-02T00:00:00.000Z',
        }),
        makeObservation({
          id: 'eta-11-expected',
          event_time: '2026-05-11',
          created_at: '2026-04-03T00:00:00.000Z',
        }),
        makeObservation({
          id: 'eta-11-actual',
          event_time: '2026-05-11',
          event_time_type: 'ACTUAL',
          created_at: '2026-04-04T00:00:00.000Z',
        }),
      ],
      'eta-11-actual',
      '2026-04-05T00:00:00.000Z',
    )

    expect(predictionHistory.header).toEqual({
      tone: 'neutral',
      summary_kind: 'HISTORY_UPDATED',
      current_version_id: 'eta-11-actual',
      previous_version_id: null,
      original_version_id: 'eta-10',
      reason_kind: 'ESTIMATE_CHANGED',
    })
    expect(
      predictionHistory.versions.map((version) => ({
        id: version.id,
        state: version.version_state,
        explanatoryText: version.explanatory_text_kind,
        transition: version.transition_kind_from_previous_version,
      })),
    ).toEqual([
      {
        id: 'eta-11-actual',
        state: 'CONFIRMED',
        explanatoryText: null,
        transition: 'EVENT_CONFIRMED',
      },
      {
        id: 'eta-11-expected',
        state: 'ESTIMATE_CHANGED',
        explanatoryText: null,
        transition: 'ESTIMATE_CHANGED',
      },
      {
        id: 'eta-12',
        state: 'ESTIMATE_CHANGED',
        explanatoryText: null,
        transition: 'ESTIMATE_CHANGED',
      },
      {
        id: 'eta-10',
        state: 'INITIAL',
        explanatoryText: null,
        transition: null,
      },
    ])
  })

  it('marks the latest observed ETA revision as current when the date moves earlier', () => {
    const predictionHistory = requirePredictionHistory(
      [
        makeObservation({
          id: 'eta-08',
          event_time: '2026-05-08',
          vessel_name: 'MSC BIANCA SILVIA',
          voyage: 'UX614R',
          created_at: '2026-04-04T16:08:30.906851Z',
        }),
        makeObservation({
          id: 'eta-12',
          event_time: '2026-05-12',
          vessel_name: 'MSC BIANCA SILVIA',
          voyage: 'UX614R',
          created_at: '2026-04-08T20:05:19.293794Z',
        }),
        makeObservation({
          id: 'eta-03',
          event_time: '2026-05-03',
          vessel_name: 'MSC BIANCA SILVIA',
          voyage: 'UX614R',
          created_at: '2026-04-10T10:36:02.943421Z',
        }),
        makeObservation({
          id: 'eta-05',
          event_time: '2026-05-05',
          vessel_name: 'MSC BIANCA SILVIA',
          voyage: 'UX614R',
          created_at: '2026-04-10T17:37:48.410353Z',
        }),
      ],
      'eta-05',
      '2026-04-11T00:00:00.000Z',
    )

    expect(predictionHistory.header).toEqual({
      tone: 'neutral',
      summary_kind: 'HISTORY_UPDATED',
      current_version_id: 'eta-05',
      previous_version_id: null,
      original_version_id: 'eta-08',
      reason_kind: 'ESTIMATE_CHANGED',
    })
    expect(
      predictionHistory.versions.map((version) => ({
        id: version.id,
        isCurrent: version.is_current,
        state: version.version_state,
      })),
    ).toEqual([
      {
        id: 'eta-05',
        isCurrent: true,
        state: 'ESTIMATE_CHANGED',
      },
      {
        id: 'eta-03',
        isCurrent: false,
        state: 'ESTIMATE_CHANGED',
      },
      {
        id: 'eta-12',
        isCurrent: false,
        state: 'ESTIMATE_CHANGED',
      },
      {
        id: 'eta-08',
        isCurrent: false,
        state: 'INITIAL',
      },
    ])
  })

  it('marks actual voyage conflicts as conflicted and emits a conflict banner', () => {
    const predictionHistory = requirePredictionHistory(
      [
        makeObservation({
          id: 'discharge-old',
          type: 'DISCHARGE',
          event_time_type: 'ACTUAL',
          event_time: '2026-03-28',
          vessel_name: 'MSC ARICA',
          voyage: 'IV610A',
          location_code: 'LKCMB',
          location_display: 'COLOMBO, LK',
          created_at: '2026-04-02T19:12:43.853916Z',
        }),
        makeObservation({
          id: 'discharge-new',
          type: 'DISCHARGE',
          event_time_type: 'ACTUAL',
          event_time: '2026-03-28',
          vessel_name: 'MSC ARICA',
          voyage: 'OB610R',
          location_code: 'LKCMB',
          location_display: 'COLOMBO, LK',
          created_at: '2026-04-04T16:53:10.273469Z',
        }),
      ],
      'discharge-new',
      '2026-04-05T00:00:00.000Z',
    )

    expect(predictionHistory.header).toEqual({
      tone: 'danger',
      summary_kind: 'CONFLICT_DETECTED',
      current_version_id: 'discharge-new',
      previous_version_id: 'discharge-old',
      original_version_id: null,
      reason_kind: 'VOYAGE_CHANGED_AFTER_CONFIRMATION',
    })
    expect(
      predictionHistory.versions.map((version) => ({
        id: version.id,
        state: version.version_state,
        explanatoryText: version.explanatory_text_kind,
        transition: version.transition_kind_from_previous_version,
      })),
    ).toEqual([
      {
        id: 'discharge-new',
        state: 'CONFIRMED',
        explanatoryText: null,
        transition: 'VOYAGE_CHANGED_AFTER_CONFIRMATION',
      },
      {
        id: 'discharge-old',
        state: 'CONFIRMED_BEFORE',
        explanatoryText: 'REPORTED_AS_ACTUAL_AND_CORRECTED_LATER',
        transition: null,
      },
    ])
  })

  it('marks non-conflicting voyage substitutions as substituted without a conflict banner', () => {
    const predictionHistory = requirePredictionHistory(
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
      'final-specific-new',
      '2026-04-06T00:00:00.000Z',
    )

    expect(predictionHistory.header).toEqual({
      tone: 'neutral',
      summary_kind: 'HISTORY_UPDATED',
      current_version_id: 'final-specific-new',
      previous_version_id: null,
      original_version_id: 'final-generic-old',
      reason_kind: 'PREVIOUS_VERSION_SUBSTITUTED',
    })
    expect(
      predictionHistory.versions.map((version) => ({
        id: version.id,
        state: version.version_state,
        explanatoryText: version.explanatory_text_kind,
        transition: version.transition_kind_from_previous_version,
      })),
    ).toEqual([
      {
        id: 'final-specific-new',
        state: 'ESTIMATE_CHANGED',
        explanatoryText: null,
        transition: 'PREVIOUS_VERSION_SUBSTITUTED',
      },
      {
        id: 'final-generic-old',
        state: 'SUBSTITUTED',
        explanatoryText: null,
        transition: null,
      },
    ])
  })

  it('does not collapse non-consecutive returns to a previous ETA identity', () => {
    const predictionHistory = requirePredictionHistory(
      [
        makeObservation({
          id: 'eta-10-original',
          event_time: '2026-05-10',
          created_at: '2026-04-01T00:00:00.000Z',
        }),
        makeObservation({
          id: 'eta-12-middle',
          event_time: '2026-05-12',
          created_at: '2026-04-02T00:00:00.000Z',
        }),
        makeObservation({
          id: 'eta-10-return',
          event_time: '2026-05-10',
          created_at: '2026-04-03T00:00:00.000Z',
        }),
      ],
      'eta-10-return',
      '2026-04-05T00:00:00.000Z',
    )

    expect(predictionHistory.header).toEqual({
      tone: 'neutral',
      summary_kind: 'HISTORY_UPDATED',
      current_version_id: 'eta-10-return',
      previous_version_id: null,
      original_version_id: 'eta-10-original',
      reason_kind: 'ESTIMATE_CHANGED',
    })
    expect(predictionHistory.versions).toHaveLength(3)
    expect(
      predictionHistory.versions.map((version) => ({
        id: version.id,
        state: version.version_state,
      })),
    ).toEqual([
      {
        id: 'eta-10-return',
        state: 'ESTIMATE_CHANGED',
      },
      {
        id: 'eta-12-middle',
        state: 'ESTIMATE_CHANGED',
      },
      {
        id: 'eta-10-original',
        state: 'INITIAL',
      },
    ])
  })
})
