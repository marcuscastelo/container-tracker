import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'

/**
 * Command to acknowledge a tracking alert.
 */
type AcknowledgeAlertCommand = {
  readonly alertId: string
  readonly ackedAt: string
}

/**
 * Result of acknowledging an alert (void — fire-and-forget).
 */
type AcknowledgeAlertResult = undefined

/**
 * Acknowledge a tracking alert by id.
 *
 * Delegates directly to the repository — no domain logic involved.
 */
export async function acknowledgeAlert(
  deps: TrackingUseCasesDeps,
  cmd: AcknowledgeAlertCommand,
): Promise<AcknowledgeAlertResult> {
  await deps.trackingAlertRepository.acknowledge(cmd.alertId, cmd.ackedAt)
}
