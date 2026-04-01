import type { Accessor } from 'solid-js'
import { createMemo, createSignal, onCleanup } from 'solid-js'
import {
  fetchProcessesSyncStatus,
  syncAllProcessesRequest,
  syncProcessRequest,
} from '~/modules/process/ui/api/processSync.api'
import { useProcessSyncRealtime } from '~/modules/process/ui/hooks/useProcessSyncRealtime'
import { refreshDashboardData } from '~/modules/process/ui/utils/dashboard-refresh'
import {
  type DashboardLocalSyncStatus,
  resolveDashboardProcessSyncStatus,
} from '~/modules/process/ui/utils/dashboard-sync-reconciliation'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'

const LOCAL_SYNC_FEEDBACK_TTL_MS = 2_500
const REALTIME_RECONCILIATION_DEBOUNCE_MS = 250

type LocalSyncStateByProcessId = Readonly<Record<string, DashboardLocalSyncStatus>>

type UseDashboardSyncControllerCommand = {
  readonly allProcesses: Accessor<readonly ProcessSummaryVM[]>
  readonly sortedProcesses: Accessor<readonly ProcessSummaryVM[]>
  readonly refetchProcesses: () => unknown
  readonly refetchGlobalAlerts: () => unknown
  readonly refetchDashboardKpis: () => unknown
  readonly refetchDashboardProcessesCreatedByMonth: () => unknown
}

type DashboardSyncControllerResult = {
  readonly processesWithSyncFeedback: Accessor<readonly ProcessSummaryVM[]>
  readonly handleDashboardRefresh: () => Promise<void>
  readonly handleProcessSync: (processId: string) => Promise<void>
}

type ProcessesSyncSnapshot = Awaited<ReturnType<typeof fetchProcessesSyncStatus>>

export function schedulePerProcessLocalSyncExpiry(command: {
  readonly processIds: readonly string[]
  readonly ttlMs: number
  readonly onExpire: (processId: string) => void
}): ReadonlyMap<string, ReturnType<typeof setTimeout>> {
  const timeoutByProcessId = new Map<string, ReturnType<typeof setTimeout>>()

  for (const processId of command.processIds) {
    const timeoutId = setTimeout(() => {
      command.onExpire(processId)
    }, command.ttlMs)
    timeoutByProcessId.set(processId, timeoutId)
  }

  return timeoutByProcessId
}

function withProcessLocalSyncState(
  currentState: LocalSyncStateByProcessId,
  processId: string,
  syncStatus: DashboardLocalSyncStatus,
): LocalSyncStateByProcessId {
  if (currentState[processId] === syncStatus) {
    return currentState
  }

  return {
    ...currentState,
    [processId]: syncStatus,
  }
}

function withManyProcessLocalSyncStates(
  currentState: LocalSyncStateByProcessId,
  processIds: readonly string[],
  syncStatus: DashboardLocalSyncStatus,
): LocalSyncStateByProcessId {
  let hasChanges = false
  const nextState: Record<string, DashboardLocalSyncStatus> = { ...currentState }

  for (const processId of processIds) {
    if (nextState[processId] === syncStatus) continue
    nextState[processId] = syncStatus
    hasChanges = true
  }

  return hasChanges ? nextState : currentState
}

function withoutProcessLocalSyncState(
  currentState: LocalSyncStateByProcessId,
  processId: string,
): LocalSyncStateByProcessId {
  if (!(processId in currentState)) {
    return currentState
  }

  const nextState: Record<string, DashboardLocalSyncStatus> = { ...currentState }
  delete nextState[processId]
  return nextState
}

function toDashboardLocalSyncStateFromSnapshot(
  syncStatus: 'idle' | 'syncing' | 'completed' | 'failed',
): DashboardLocalSyncStatus | null {
  if (syncStatus === 'syncing') return 'syncing'
  if (syncStatus === 'completed') return 'success'
  if (syncStatus === 'failed') return 'error'
  return null
}

function applyLocalSyncStateFromServerSnapshot(command: {
  readonly processIds: readonly string[]
  readonly snapshot: ProcessesSyncSnapshot
  readonly setLocalSyncState: (
    processId: string,
    syncStatus: DashboardLocalSyncStatus,
    options?: { readonly ttlMs?: number },
  ) => void
  readonly clearLocalSyncState: (processId: string) => void
}): void {
  const syncStatusByProcessId = new Map(
    command.snapshot.processes.map((process) => [process.process_id, process.sync_status] as const),
  )

  for (const processId of command.processIds) {
    const syncStatus = syncStatusByProcessId.get(processId) ?? 'idle'
    const localSyncStatus = toDashboardLocalSyncStateFromSnapshot(syncStatus)

    if (localSyncStatus === 'syncing') {
      command.setLocalSyncState(processId, localSyncStatus)
      continue
    }

    if (localSyncStatus === null) {
      command.clearLocalSyncState(processId)
      continue
    }

    command.setLocalSyncState(processId, localSyncStatus, {
      ttlMs: LOCAL_SYNC_FEEDBACK_TTL_MS,
    })
  }
}

export function useDashboardSyncController(
  command: UseDashboardSyncControllerCommand,
): DashboardSyncControllerResult {
  const [localSyncStateByProcessId, setLocalSyncStateByProcessId] =
    createSignal<LocalSyncStateByProcessId>({})

  const localSyncFeedbackTimeoutByProcessId = new Map<string, ReturnType<typeof setTimeout>>()
  let realtimeReconciliationTimeoutId: ReturnType<typeof setTimeout> | null = null
  let realtimeReconciliationInFlight = false
  let pendingRealtimeReconciliation = false

  const clearLocalSyncFeedbackTimer = (processId: string): void => {
    const timeoutId = localSyncFeedbackTimeoutByProcessId.get(processId)
    if (timeoutId === undefined) return
    clearTimeout(timeoutId)
    localSyncFeedbackTimeoutByProcessId.delete(processId)
  }

  const clearLocalSyncState = (processId: string): void => {
    clearLocalSyncFeedbackTimer(processId)
    setLocalSyncStateByProcessId((previous) => withoutProcessLocalSyncState(previous, processId))
  }

  const setLocalSyncState = (
    processId: string,
    syncStatus: DashboardLocalSyncStatus,
    options?: { readonly ttlMs?: number },
  ): void => {
    clearLocalSyncFeedbackTimer(processId)
    setLocalSyncStateByProcessId((previous) =>
      withProcessLocalSyncState(previous, processId, syncStatus),
    )

    if (options?.ttlMs === undefined) return

    const timeoutId = setTimeout(() => {
      clearLocalSyncState(processId)
    }, options.ttlMs)
    localSyncFeedbackTimeoutByProcessId.set(processId, timeoutId)
  }

  const setLocalSyncStates = (
    processIds: readonly string[],
    syncStatus: DashboardLocalSyncStatus,
    options?: { readonly ttlMs?: number },
  ): void => {
    if (processIds.length === 0) return

    for (const processId of processIds) {
      clearLocalSyncFeedbackTimer(processId)
    }

    setLocalSyncStateByProcessId((previous) =>
      withManyProcessLocalSyncStates(previous, processIds, syncStatus),
    )

    if (options?.ttlMs === undefined) return

    const timeoutByProcessId = schedulePerProcessLocalSyncExpiry({
      processIds,
      ttlMs: options.ttlMs,
      onExpire: (processId) => {
        clearLocalSyncState(processId)
      },
    })

    for (const [processId, timeoutId] of timeoutByProcessId.entries()) {
      localSyncFeedbackTimeoutByProcessId.set(processId, timeoutId)
    }
  }

  const clearRealtimeReconciliationTimer = (): void => {
    if (realtimeReconciliationTimeoutId === null) return
    clearTimeout(realtimeReconciliationTimeoutId)
    realtimeReconciliationTimeoutId = null
  }

  const reconcileProcessesFromServerSnapshot = async (): Promise<void> => {
    if (realtimeReconciliationInFlight) {
      pendingRealtimeReconciliation = true
      return
    }

    realtimeReconciliationInFlight = true
    try {
      const currentProcessIds = command.allProcesses().map((process) => process.id)
      if (currentProcessIds.length === 0) return

      const snapshot = await fetchProcessesSyncStatus(currentProcessIds)
      applyLocalSyncStateFromServerSnapshot({
        processIds: currentProcessIds,
        snapshot,
        setLocalSyncState,
        clearLocalSyncState,
      })
    } catch (error) {
      console.error('Failed to reconcile dashboard process sync state from realtime:', error)
    } finally {
      realtimeReconciliationInFlight = false
      if (pendingRealtimeReconciliation) {
        pendingRealtimeReconciliation = false
        try {
          await reconcileProcessesFromServerSnapshot()
        } catch (error) {
          console.error('Failed to perform pending realtime reconciliation:', error)
        }
      }
    }
  }

  const scheduleRealtimeReconciliation = (): void => {
    clearRealtimeReconciliationTimer()
    realtimeReconciliationTimeoutId = setTimeout(() => {
      realtimeReconciliationTimeoutId = null
      void reconcileProcessesFromServerSnapshot()
    }, REALTIME_RECONCILIATION_DEBOUNCE_MS)
  }

  onCleanup(() => {
    clearRealtimeReconciliationTimer()
    for (const timeoutId of localSyncFeedbackTimeoutByProcessId.values()) {
      clearTimeout(timeoutId)
    }
    localSyncFeedbackTimeoutByProcessId.clear()
  })

  const realtimeSyncStateByProcessId = useProcessSyncRealtime({
    processes: command.allProcesses,
    onRealtimeStateChanged: scheduleRealtimeReconciliation,
  })

  const processesWithSyncFeedback = createMemo(() => {
    const realtimeStateByProcessId = realtimeSyncStateByProcessId()
    const localStateByProcessId = localSyncStateByProcessId()

    return command.sortedProcesses().map((process) => {
      const resolvedSyncState = resolveDashboardProcessSyncStatus({
        serverSnapshotState: process.syncStatus,
        realtimeState: realtimeStateByProcessId[process.id] === 'syncing' ? 'syncing' : null,
        localState: localStateByProcessId[process.id] ?? null,
      })

      if (resolvedSyncState === process.syncStatus) return process

      return {
        ...process,
        syncStatus: resolvedSyncState,
      }
    })
  })

  const handleDashboardRefresh = async () => {
    const currentProcessIds = command.allProcesses().map((process) => process.id)
    setLocalSyncStates(currentProcessIds, 'syncing')

    try {
      await refreshDashboardData({
        syncAllProcesses: syncAllProcessesRequest,
        refetchProcesses: command.refetchProcesses,
        refetchGlobalAlerts: command.refetchGlobalAlerts,
        refetchDashboardKpis: command.refetchDashboardKpis,
        refetchDashboardProcessesCreatedByMonth: command.refetchDashboardProcessesCreatedByMonth,
      })

      setLocalSyncStates(currentProcessIds, 'success', {
        ttlMs: LOCAL_SYNC_FEEDBACK_TTL_MS,
      })
    } catch (error) {
      setLocalSyncStates(currentProcessIds, 'error', {
        ttlMs: LOCAL_SYNC_FEEDBACK_TTL_MS,
      })
      throw error
    }
  }

  const handleProcessSync = async (processId: string) => {
    const currentLocalState = localSyncStateByProcessId()[processId]
    if (currentLocalState === 'syncing') return

    setLocalSyncState(processId, 'syncing')

    try {
      await syncProcessRequest(processId)
      await Promise.resolve(command.refetchProcesses())
      setLocalSyncState(processId, 'success', {
        ttlMs: LOCAL_SYNC_FEEDBACK_TTL_MS,
      })
    } catch (error) {
      console.error(`Dashboard process sync failed for ${processId}:`, error)
      await Promise.resolve(command.refetchProcesses()).catch((refetchError: unknown) => {
        console.error(
          `Failed to reconcile dashboard process row after sync failure for ${processId}:`,
          refetchError,
        )
      })
      setLocalSyncState(processId, 'error', {
        ttlMs: LOCAL_SYNC_FEEDBACK_TTL_MS,
      })
    }
  }

  return {
    processesWithSyncFeedback,
    handleDashboardRefresh,
    handleProcessSync,
  }
}
