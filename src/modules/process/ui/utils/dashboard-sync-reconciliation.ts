import type { ProcessSyncStatus } from '~/modules/process/ui/viewmodels/process-summary.vm'

export type DashboardRealtimeSyncStatus = Extract<ProcessSyncStatus, 'syncing'>
export type DashboardLocalSyncStatus = Extract<ProcessSyncStatus, 'syncing' | 'success' | 'error'>

type ResolveDashboardProcessSyncStatusCommand = {
  readonly serverSnapshotState: ProcessSyncStatus
  readonly realtimeState?: DashboardRealtimeSyncStatus | null
  readonly localState?: DashboardLocalSyncStatus | null
}

/**
 * Reconciles dashboard sync visual state using a server-first strategy:
 * 1) server snapshot for active sync always wins
 * 2) realtime may expose active sync before the next refetch
 * 3) local state is only transient UX feedback
 */
export function resolveDashboardProcessSyncStatus(
  command: ResolveDashboardProcessSyncStatusCommand,
): ProcessSyncStatus {
  if (command.serverSnapshotState === 'syncing') return 'syncing'
  if (command.realtimeState === 'syncing') return 'syncing'
  if (command.localState === 'syncing') return 'syncing'
  if (command.localState === 'success') return 'success'
  if (command.localState === 'error') return 'error'
  return 'idle'
}
