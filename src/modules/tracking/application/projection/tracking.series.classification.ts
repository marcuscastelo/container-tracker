import type { TrackingObservationDTO } from '~/modules/tracking/application/projection/tracking.observation.dto'
import type { SeriesLabel } from '~/modules/tracking/domain/reconcile/seriesClassification'
import { classifySeries } from '~/modules/tracking/domain/reconcile/seriesClassification'

export type { SeriesLabel }

export function classifyTrackingSeries(series: readonly TrackingObservationDTO[], now?: Date) {
  return classifySeries(series, now)
}
