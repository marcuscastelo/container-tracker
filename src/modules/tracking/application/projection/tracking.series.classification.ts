import type { TrackingObservationProjection } from '~/modules/tracking/application/projection/tracking.observation.projection'
import type { SeriesLabel } from '~/modules/tracking/domain/reconcile/seriesClassification'
import { classifySeries } from '~/modules/tracking/domain/reconcile/seriesClassification'

export type { SeriesLabel }

export function classifyTrackingSeries(
  series: readonly TrackingObservationProjection[],
  now?: Date,
) {
  return classifySeries(series, now)
}
