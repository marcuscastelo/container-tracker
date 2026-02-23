import { formatRelativeTime } from '~/modules/process/ui/utils/formatRelativeTime'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import {
  type TrackingAlertProjection,
  type TrackingAlertProjectionSource,
  toTrackingAlertProjections,
} from '~/modules/tracking/application/projection/tracking.alert.projection'

function projectionToAlertDisplayVM(
  projection: TrackingAlertProjection,
  locale: string,
): AlertDisplayVM {
  return {
    id: projection.id,
    type: projection.type,
    severity: projection.severity,
    message: projection.message,
    timestamp: formatRelativeTime(projection.triggeredAtIso, new Date(), locale),
    triggeredAtIso: projection.triggeredAtIso,
    category: projection.category,
    retroactive: projection.retroactive,
  }
}

export function toAlertDisplayVMs(
  alerts: readonly TrackingAlertProjectionSource[],
  locale: string = 'en-US',
): readonly AlertDisplayVM[] {
  return toTrackingAlertProjections(alerts).map((projection) =>
    projectionToAlertDisplayVM(projection, locale),
  )
}
