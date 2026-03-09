import type { SeriesLabel } from '~/modules/tracking/domain/reconcile/seriesClassification'
import { classifySeries } from '~/modules/tracking/domain/reconcile/seriesClassification'
import type { TrackingObservationProjection } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'

export type { SeriesLabel }

export function classifyTrackingSeries(
  series: readonly TrackingObservationProjection[],
  now?: Date,
) {
  return classifySeries(series, now)
}
