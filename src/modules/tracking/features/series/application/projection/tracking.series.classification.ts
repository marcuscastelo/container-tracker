import type { TrackingObservationProjection } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import type { SeriesLabel } from '~/modules/tracking/features/series/domain/reconcile/seriesClassification'
import { classifySeries } from '~/modules/tracking/features/series/domain/reconcile/seriesClassification'

export type { SeriesLabel }

export function classifyTrackingSeries(
  series: readonly TrackingObservationProjection[],
  now?: Date,
) {
  return classifySeries(series, now)
}
