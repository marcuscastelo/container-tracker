import type { TrackingTimeTravelSyncVM } from '~/modules/process/ui/screens/shipment/types/tracking-time-travel.vm'

export function findTrackingTimeTravelSync(
  syncs: readonly TrackingTimeTravelSyncVM[],
  snapshotId: string,
): TrackingTimeTravelSyncVM | null {
  return syncs.find((sync) => sync.snapshotId === snapshotId) ?? null
}

export function selectAdjacentTrackingTimeTravelSnapshotId(command: {
  readonly syncs: readonly TrackingTimeTravelSyncVM[]
  readonly currentSnapshotId: string
  readonly direction: 'previous' | 'next'
}): string | null {
  const currentIndex = command.syncs.findIndex(
    (sync) => sync.snapshotId === command.currentSnapshotId,
  )
  if (currentIndex < 0) return null

  const targetIndex = command.direction === 'previous' ? currentIndex - 1 : currentIndex + 1
  return command.syncs[targetIndex]?.snapshotId ?? null
}
