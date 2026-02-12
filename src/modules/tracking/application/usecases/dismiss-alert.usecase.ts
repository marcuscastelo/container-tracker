import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'

/**
 * Command to dismiss a tracking alert.
 */
export type DismissAlertCommand = {
  readonly alertId: string
  readonly dismissedAt: string
}

/**
 * Result of dismissing an alert (void — fire-and-forget).
 */
export type DismissAlertResult = undefined

/**
 * Dismiss a tracking alert by id.
 *
 * Delegates directly to the repository — no domain logic involved.
 */
export async function dismissAlert(
  deps: TrackingUseCasesDeps,
  cmd: DismissAlertCommand,
): Promise<DismissAlertResult> {
  await deps.trackingAlertRepository.dismiss(cmd.alertId, cmd.dismissedAt)
}
