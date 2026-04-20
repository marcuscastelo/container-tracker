export const HEALTH_POLL_INTERVAL_MS = 500
export const DEFAULT_STARTUP_TIMEOUT_MS = 30_000
export const DEFAULT_HEALTH_GRACE_MS = 120_000

export function shouldRollbackFromHealthGate(command: {
  readonly startupConfirmed: boolean
  readonly startupTimedOut: boolean
  readonly healthGraceConfirmed: boolean
}): boolean {
  return (
    !command.startupConfirmed ||
    command.startupTimedOut ||
    (command.startupConfirmed && !command.healthGraceConfirmed)
  )
}
