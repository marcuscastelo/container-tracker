import {
  DEFAULT_HEALTH_GRACE_MS,
  DEFAULT_STARTUP_TIMEOUT_MS,
  shouldRollbackFromHealthGate,
} from '@agent/runtime/domain/runtime-health-policy'

export { DEFAULT_HEALTH_GRACE_MS, DEFAULT_STARTUP_TIMEOUT_MS }

export function shouldRollbackAfterHealthGate(command: {
  readonly startupConfirmed: boolean
  readonly startupTimedOut: boolean
  readonly healthGraceConfirmed: boolean
}): boolean {
  return shouldRollbackFromHealthGate(command)
}
