import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'
import {
  type ClassifiedObservation,
  classifySeries,
} from '~/modules/tracking/features/series/domain/reconcile/seriesClassification'
import {
  buildSeriesKey,
  compareObservationsChronologically,
} from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import type { TrackingValidationDetector } from '~/modules/tracking/features/validation/domain/model/trackingValidationDetector'
import type { TrackingValidationFinding } from '~/modules/tracking/features/validation/domain/model/trackingValidationFinding'
import { digestTrackingValidationFingerprint } from '~/modules/tracking/features/validation/domain/services/trackingValidationFingerprint'

const DETECTOR_ID = 'EXPECTED_PLAN_NOT_RECONCILABLE'
const DETECTOR_VERSION = '1'
const SUMMARY_KEY = 'tracking.validation.expectedPlanNotReconcilable'
const ALLOWED_SERIES_TYPES: ReadonlySet<ObservationType> = new Set([
  'LOAD',
  'DEPARTURE',
  'ARRIVAL',
  'DISCHARGE',
  'DELIVERY',
])

type ObservationSeries = readonly Observation[]

function groupObservationsBySeries(
  observations: readonly Observation[],
): ReadonlyMap<string, ObservationSeries> {
  const seriesByKey = new Map<string, Observation[]>()

  for (const observation of observations) {
    const seriesKey = buildSeriesKey(observation)
    const series = seriesByKey.get(seriesKey)
    if (series === undefined) {
      seriesByKey.set(seriesKey, [observation])
      continue
    }

    series.push(observation)
  }

  return seriesByKey
}

function findRedundantExpectedObservations(
  classified: readonly ClassifiedObservation<Observation>[],
): readonly Observation[] {
  return classified.filter(
    (observation) =>
      observation.event_time_type === 'EXPECTED' &&
      observation.seriesLabel === 'REDUNDANT_AFTER_ACTUAL',
  )
}

function describeEvidence(primary: Observation, redundantExpectedCount: number): string {
  const locationCode = primary.location_code ?? 'unknown location'
  const expectedLabel =
    redundantExpectedCount === 1 ? 'Expected event remained' : 'Expected events remained'

  return `${expectedLabel} after ACTUAL ${primary.type} confirmation in the same series at ${locationCode}.`
}

function buildStateFingerprint(
  primary: Observation,
  redundantExpecteds: readonly Observation[],
): string {
  return digestTrackingValidationFingerprint(
    [
      primary.fingerprint,
      ...redundantExpecteds.map((observation) => observation.fingerprint),
    ].sort(),
  )
}

function createFinding(
  seriesKey: string,
  series: ObservationSeries,
  now: Parameters<typeof classifySeries>[1],
): TrackingValidationFinding | null {
  if (series.length < 2) return null

  const sortedSeries = [...series].sort(compareObservationsChronologically)
  const classification = classifySeries(sortedSeries, now)
  const primary = classification.primary

  if (primary === null || primary.event_time_type !== 'ACTUAL') {
    return null
  }
  if (!ALLOWED_SERIES_TYPES.has(primary.type)) {
    return null
  }

  const redundantExpecteds = findRedundantExpectedObservations(classification.classified)
  if (redundantExpecteds.length === 0) {
    return null
  }

  return {
    detectorId: DETECTOR_ID,
    detectorVersion: DETECTOR_VERSION,
    code: DETECTOR_ID,
    lifecycleKey: `${DETECTOR_ID}:${seriesKey}`,
    stateFingerprint: buildStateFingerprint(primary, redundantExpecteds),
    severity: 'ADVISORY',
    affectedScope: 'SERIES',
    summaryKey: SUMMARY_KEY,
    affectedLocation: primary.location_code ?? null,
    affectedBlockLabelKey: null,
    evidenceSummary: describeEvidence(primary, redundantExpecteds.length),
    debugEvidence: {
      locationCode: primary.location_code,
      primaryObservationId: primary.id,
      redundantExpectedCount: redundantExpecteds.length,
      redundantExpectedObservationIds: redundantExpecteds
        .map((observation) => observation.id)
        .join(','),
      seriesKey,
      seriesType: primary.type,
    },
    isActive: true,
  }
}

export const expectedPlanNotReconcilableDetector: TrackingValidationDetector = {
  id: DETECTOR_ID,
  version: DETECTOR_VERSION,
  detect(context) {
    const findings: TrackingValidationFinding[] = []

    for (const [seriesKey, series] of groupObservationsBySeries(context.observations)) {
      const finding = createFinding(seriesKey, series, context.now)
      if (finding !== null) {
        findings.push(finding)
      }
    }

    return findings
  },
}
