import type { TrackingObservationDTO } from '~/modules/tracking/application/projection/tracking.observation.dto'
import {
  classifySeries,
  getSeriesLabelClass,
  getSeriesLabelKey,
} from '~/modules/tracking/domain/reconcile/seriesClassification'

export function classifyTrackingSeries(series: readonly TrackingObservationDTO[], now?: Date) {
  return classifySeries(series, now)
}

export { getSeriesLabelClass, getSeriesLabelKey }
