export function toTrackingTimeTravelResourceKey(command: {
  readonly isActive: boolean
  readonly containerId: string | null
  readonly trackingFreshnessToken: string | null
}): readonly [string, string] | null {
  if (!command.isActive) return null
  if (command.containerId === null) return null

  return [command.containerId, command.trackingFreshnessToken ?? 'tracking-freshness:unknown']
}
