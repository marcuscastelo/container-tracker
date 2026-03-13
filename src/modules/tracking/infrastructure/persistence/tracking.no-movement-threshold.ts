export const NO_MOVEMENT_BREAKPOINTS_DAYS = [5, 10, 20, 30] as const

export function normalizeNoMovementThresholdDays(rawThresholdDays: number): number {
  const normalizedCandidate = Math.floor(rawThresholdDays)
  const eligible = NO_MOVEMENT_BREAKPOINTS_DAYS.filter(
    (thresholdDays) => normalizedCandidate >= thresholdDays,
  )
  if (eligible.length === 0) return normalizedCandidate
  return eligible[eligible.length - 1] ?? normalizedCandidate
}
