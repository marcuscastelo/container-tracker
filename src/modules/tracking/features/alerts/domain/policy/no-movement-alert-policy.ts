const NO_MOVEMENT_BREAKPOINTS_DAYS = [5, 10, 20, 30] as const

export function classifyNoMovementBreakpoint(daysWithoutMovement: number): number | null {
  const eligible = NO_MOVEMENT_BREAKPOINTS_DAYS.filter(
    (thresholdDays) => daysWithoutMovement >= thresholdDays,
  )
  if (eligible.length === 0) return null
  return eligible[eligible.length - 1] ?? null
}

export function normalizeNoMovementThresholdDays(rawThresholdDays: number): number {
  const normalizedCandidate = Math.floor(rawThresholdDays)
  const breakpoint = classifyNoMovementBreakpoint(normalizedCandidate)
  if (breakpoint !== null) return breakpoint
  return normalizedCandidate
}
