export function buildRecentUpdateHint(command: {
  readonly elapsedMs: number
  readonly toSecondsLabel: (count: number) => string
  readonly toMinutesLabel: (count: number) => string
}): string {
  const elapsedSeconds = Math.max(1, Math.floor(command.elapsedMs / 1000))
  if (elapsedSeconds < 60) {
    return command.toSecondsLabel(elapsedSeconds)
  }

  const elapsedMinutes = Math.max(1, Math.floor(elapsedSeconds / 60))
  return command.toMinutesLabel(elapsedMinutes)
}
