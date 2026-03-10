export const DASHBOARD_REFRESH_COOLDOWN_MS = 2_000

export function toDashboardRefreshCooldownUntilMs(
  clickStartedAtMs: number,
  cooldownMs: number = DASHBOARD_REFRESH_COOLDOWN_MS,
): number {
  return clickStartedAtMs + cooldownMs
}

export function isDashboardRefreshBlocked(command: {
  readonly isLoading: boolean
  readonly cooldownUntilMs: number | null
  readonly nowMs: number
}): boolean {
  if (command.isLoading) return true
  if (command.cooldownUntilMs === null) return false
  return command.nowMs < command.cooldownUntilMs
}
