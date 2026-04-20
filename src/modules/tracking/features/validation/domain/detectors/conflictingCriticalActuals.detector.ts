import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'
import { buildCanonicalSeriesGroups } from '~/modules/tracking/features/series/domain/reconcile/canonicalSeries'
import { classifySeries } from '~/modules/tracking/features/series/domain/reconcile/seriesClassification'
import type { TrackingValidationDetector } from '~/modules/tracking/features/validation/domain/model/trackingValidationDetector'
import type { TrackingValidationFinding } from '~/modules/tracking/features/validation/domain/model/trackingValidationFinding'
import { digestTrackingValidationFingerprint } from '~/modules/tracking/features/validation/domain/services/trackingValidationFingerprint'
import type { Instant } from '~/shared/time/instant'

const DETECTOR_ID = 'CONFLICTING_CRITICAL_ACTUALS'
const DETECTOR_VERSION = '1'
const SUMMARY_KEY = 'tracking.validation.conflictingCriticalActuals'
const CRITICAL_ACTUAL_SERIES_TYPES: ReadonlySet<ObservationType> = new Set([
  'ARRIVAL',
  'DELIVERY',
  'DISCHARGE',
  'EMPTY_RETURN',
])

type ObservationSeries = readonly Observation[]

function describeEvidence(primary: Observation): string {
  const locationCode = primary.location_code ?? 'unknown location'
  return `Multiple ACTUAL ${primary.type} observations conflict in the same series at ${locationCode}.`
}

function buildLifecycleKey(seriesKey: string): string {
  return `${DETECTOR_ID}:${seriesKey}`
}

function buildStateFingerprint(series: readonly Observation[]): string {
  const actualFingerprints = series
    .filter((observation) => observation.event_time_type === 'ACTUAL')
    .map((observation) => observation.fingerprint)
    .sort()

  return digestTrackingValidationFingerprint(actualFingerprints)
}

function createFinding(
  seriesKey: string,
  series: ObservationSeries,
  now: Instant,
): TrackingValidationFinding | null {
  if (series.length < 2) return null

  const classification = classifySeries(series, now)
  if (!classification.hasActualConflict) return null
  if (classification.primary === null) return null
  if (!CRITICAL_ACTUAL_SERIES_TYPES.has(classification.primary.type)) return null

  return {
    detectorId: DETECTOR_ID,
    detectorVersion: DETECTOR_VERSION,
    code: DETECTOR_ID,
    lifecycleKey: buildLifecycleKey(seriesKey),
    stateFingerprint: buildStateFingerprint(series),
    severity: 'CRITICAL',
    affectedScope: 'SERIES',
    summaryKey: SUMMARY_KEY,
    affectedLocation: classification.primary.location_code ?? null,
    affectedBlockLabelKey: null,
    evidenceSummary: describeEvidence(classification.primary),
    debugEvidence: {
      conflictingActualCount: classification.conflictingActualCount,
      locationCode: classification.primary.location_code,
      primaryObservationId: classification.primary.id,
      seriesKey,
      seriesType: classification.primary.type,
    },
    isActive: true,
  }
}

export const conflictingCriticalActualsDetector: TrackingValidationDetector = {
  id: DETECTOR_ID,
  version: DETECTOR_VERSION,
  detect(context) {
    const findings: TrackingValidationFinding[] = []

    for (const canonicalSeries of buildCanonicalSeriesGroups(context.observations, context.now)) {
      const finding = createFinding(canonicalSeries.key, canonicalSeries.observations, context.now)
      if (finding !== null) {
        findings.push(finding)
      }
    }

    return findings
  },
}
