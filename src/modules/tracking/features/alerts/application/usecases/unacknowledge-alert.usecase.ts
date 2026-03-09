import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'

/**
 * Command to mark an acknowledged tracking alert as active again.
 */
type UnacknowledgeAlertCommand = {
  readonly alertId: string
}

/**
 * Result of unacknowledging an alert (void — fire-and-forget).
 */
type UnacknowledgeAlertResult = undefined

/**
 * Unacknowledge a tracking alert by id.
 *
 * Delegates directly to the repository — no domain logic involved.
 */
export async function unacknowledgeAlert(
  deps: TrackingUseCasesDeps,
  cmd: UnacknowledgeAlertCommand,
): Promise<UnacknowledgeAlertResult> {
  await deps.trackingAlertRepository.unacknowledge(cmd.alertId)
}
