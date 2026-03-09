import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import { toTrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'

/**
 * Result shape for global operational active alerts read model.
 */
export type ListActiveAlertReadModelResult = {
  readonly alerts: ReturnType<typeof toTrackingActiveAlertReadModel>
}

/**
 * List active alerts enriched with process ownership for operational views.
 */
export async function listActiveAlertReadModel(
  deps: TrackingUseCasesDeps,
): Promise<ListActiveAlertReadModelResult> {
  const alerts = await deps.trackingAlertRepository.listActiveAlertReadModel()
  return { alerts: toTrackingActiveAlertReadModel(alerts) }
}
