import { formatRelativeTime } from '~/modules/process/ui/utils/formatRelativeTime'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import {
  type TrackingAlertProjection,
  type TrackingAlertProjectionSource,
  toTrackingAlertProjections,
} from '~/modules/tracking/features/alerts/application/projection/tracking.alert.projection'
import { DEFAULT_LOCALE } from '~/shared/localization/defaultLocale'
import { systemClock } from '~/shared/time/clock'
import { parseInstantFromIso } from '~/shared/time/parsing'

function projectionToAlertDisplayVM(
  projection: TrackingAlertProjection,
  locale: string,
): AlertDisplayVM {
  const triggeredAt = parseInstantFromIso(projection.triggeredAtIso)

  return {
    id: projection.id,
    type: projection.type,
    severity: projection.severity,
    containerNumber: projection.containerNumber,
    messageKey: projection.messageKey,
    messageParams: projection.messageParams,
    timestamp: triggeredAt ? formatRelativeTime(triggeredAt, systemClock.now(), locale) : '',
    triggeredAtIso: projection.triggeredAtIso,
    ackedAtIso: projection.ackedAtIso,
    resolvedAtIso: projection.resolvedAtIso,
    lifecycleState: projection.lifecycleState,
    resolvedReason: projection.resolvedReason,
    category: projection.category,
    retroactive: projection.retroactive,
  }
}

export function toAlertDisplayVMs(
  alerts: readonly TrackingAlertProjectionSource[],
  locale: string = DEFAULT_LOCALE,
): readonly AlertDisplayVM[] {
  return toTrackingAlertProjections(alerts).map((projection) =>
    projectionToAlertDisplayVM(projection, locale),
  )
}
