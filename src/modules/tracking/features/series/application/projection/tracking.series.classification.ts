import type { TrackingObservationProjection } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import type { SeriesLabel } from '~/modules/tracking/features/series/domain/reconcile/seriesClassification'
import { classifySeries } from '~/modules/tracking/features/series/domain/reconcile/seriesClassification'
import type { Instant } from '~/shared/time/instant'

export type { SeriesLabel }

export function classifyTrackingSeries(
  series: readonly TrackingObservationProjection[],
  now?: Instant,
) {
  return classifySeries(series, now)
}
