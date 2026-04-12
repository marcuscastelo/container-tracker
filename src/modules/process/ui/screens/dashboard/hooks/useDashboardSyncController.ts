import type { Accessor } from 'solid-js'
import { createMemo, createSignal, onCleanup } from 'solid-js'
import {
  fetchProcessesSyncStatus,
  syncAllProcessesRequest,
  syncProcessRequest,
} from '~/modules/process/ui/api/processSync.api'
import { toDashboardSyncBatchResultVm } from '~/modules/process/ui/mappers/dashboard-sync-batch-result.ui-mapper'
import { useProcessSyncRealtime } from '~/modules/process/ui/hooks/useProcessSyncRealtime'
import { refreshDashboardData } from '~/modules/process/ui/utils/dashboard-refresh'
import {
  type DashboardLocalSyncStatus,
  resolveDashboardProcessSyncStatus,
} from '~/modules/process/ui/utils/dashboard-sync-reconciliation'
import type {
  DashboardProcessRowVM,
  DashboardProcessSyncIssueVM,
  DashboardSyncBatchResultVM,
} from '~/modules/process/ui/viewmodels/dashboard-sync-batch-result.vm'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'
import { useTranslation } from '~/shared/localization/i18n'

const LOCAL_SYNC_ERROR_FEEDBACK_TTL_MS = 2_500
const LOCAL_SYNC_SUCCESS_VISIBLE_TTL_MS = 30_000
const REALTIME_RECONCILIATION_DEBOUNCE_MS = 250

type LocalSyncStateByProcessId = Readonly<Record<string, DashboardLocalSyncStatus>>
type SyncIssueByProcessId = Readonly<Record<string, DashboardProcessSyncIssueVM>>
type LocalSyncFeedbackDocument = Pick<
  Document,
  'addEventListener' | 'removeEventListener' | 'visibilityState'
>
type LocalSyncFeedbackEnvironment = {
  readonly document?: LocalSyncFeedbackDocument | undefined
}
type LocalSyncFeedbackExpiryHandle = {
  readonly dispose: () => void
}

type UseDashboardSyncControllerCommand = {
  readonly allProcesses: Accessor<readonly ProcessSummaryVM[]>
  readonly sortedProcesses: Accessor<readonly ProcessSummaryVM[]>
  readonly refetchProcesses: () => unknown
  readonly refetchGlobalAlerts: () => unknown
  readonly refetchDashboardKpis: () => unknown
  readonly refetchDashboardProcessesCreatedByMonth: () => unknown
}

type DashboardSyncControllerResult = {
  readonly processesWithSyncFeedback: Accessor<readonly DashboardProcessRowVM[]>
  readonly dashboardSyncBatchResult: Accessor<DashboardSyncBatchResultVM | null>
  readonly dismissDashboardSyncBatchResult: () => void
  readonly handleDashboardRefresh: () => Promise<void>
  readonly handleProcessSync: (processId: string) => Promise<void>
}

type ProcessesSyncSnapshot = Awaited<ReturnType<typeof fetchProcessesSyncStatus>>

function resolveLocalSyncFeedbackDocument(
  environment?: LocalSyncFeedbackEnvironment,
): LocalSyncFeedbackDocument | undefined {
  if (environment?.document) {
    return environment.document
  }

  if (typeof document === 'undefined') {
    return undefined
  }

  return document
}

function isLocalSyncFeedbackDocumentVisible(
  currentDocument: LocalSyncFeedbackDocument | undefined,
): boolean {
  if (!currentDocument) {
    return true
  }

  return currentDocument.visibilityState === 'visible'
}

function createLocalSyncFeedbackExpiryHandle(command: {
  readonly ttlMs: number
  readonly onExpire: () => void
}): LocalSyncFeedbackExpiryHandle {
  const timeoutId = setTimeout(() => {
    command.onExpire()
  }, command.ttlMs)

  return {
    dispose: () => {
      clearTimeout(timeoutId)
    },
  }
}

function createVisibleLocalSyncFeedbackExpiryHandle(command: {
  readonly ttlMs: number
  readonly onExpire: () => void
  readonly environment?: LocalSyncFeedbackEnvironment
}): LocalSyncFeedbackExpiryHandle {
  const currentDocument = resolveLocalSyncFeedbackDocument(command.environment)
  if (!currentDocument) {
    return createLocalSyncFeedbackExpiryHandle({
      ttlMs: command.ttlMs,
      onExpire: command.onExpire,
    })
  }

  let remainingMs = command.ttlMs
  let countdownStartedAtMs: number | null = null
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  const clearCountdown = (): void => {
    if (timeoutId === null) {
      return
    }

    clearTimeout(timeoutId)
    timeoutId = null
  }

  const stopVisibleCountdown = (): void => {
    if (countdownStartedAtMs === null) {
      clearCountdown()
      return
    }

    const elapsedMs = Date.now() - countdownStartedAtMs
    remainingMs = Math.max(0, remainingMs - elapsedMs)
    countdownStartedAtMs = null
    clearCountdown()
  }

  const cleanup = (): void => {
    currentDocument.removeEventListener('visibilitychange', handleVisibilityChange)
    clearCountdown()
    countdownStartedAtMs = null
  }

  const expire = (): void => {
    if (disposed) {
      return
    }

    disposed = true
    cleanup()
    command.onExpire()
  }

  const startVisibleCountdown = (): void => {
    if (disposed || countdownStartedAtMs !== null) {
      return
    }

    if (!isLocalSyncFeedbackDocumentVisible(currentDocument)) {
      return
    }

    if (remainingMs <= 0) {
      expire()
      return
    }

    countdownStartedAtMs = Date.now()
    timeoutId = setTimeout(() => {
      remainingMs = 0
      countdownStartedAtMs = null
      expire()
    }, remainingMs)
  }

  function handleVisibilityChange(): void {
    if (disposed) {
      return
    }

    if (isLocalSyncFeedbackDocumentVisible(currentDocument)) {
      startVisibleCountdown()
      return
    }

    stopVisibleCountdown()
  }

  currentDocument.addEventListener('visibilitychange', handleVisibilityChange)
  startVisibleCountdown()

  return {
    dispose: () => {
      if (disposed) {
        return
      }

      disposed = true
      cleanup()
    },
  }
}

export function schedulePerProcessLocalSyncExpiry(command: {
  readonly processIds: readonly string[]
  readonly ttlMs: number
  readonly onExpire: (processId: string) => void
}): ReadonlyMap<string, LocalSyncFeedbackExpiryHandle> {
  const expiryByProcessId = new Map<string, LocalSyncFeedbackExpiryHandle>()

  for (const processId of command.processIds) {
    expiryByProcessId.set(
      processId,
      createLocalSyncFeedbackExpiryHandle({
        ttlMs: command.ttlMs,
        onExpire: () => {
          command.onExpire(processId)
        },
      }),
    )
  }

  return expiryByProcessId
}

export function schedulePerProcessVisibleLocalSyncExpiry(command: {
  readonly processIds: readonly string[]
  readonly ttlMs: number
  readonly onExpire: (processId: string) => void
  readonly environment?: LocalSyncFeedbackEnvironment
}): ReadonlyMap<string, LocalSyncFeedbackExpiryHandle> {
  const expiryByProcessId = new Map<string, LocalSyncFeedbackExpiryHandle>()

  for (const processId of command.processIds) {
    const expiryCommand =
      command.environment === undefined
        ? {
            ttlMs: command.ttlMs,
            onExpire: () => {
              command.onExpire(processId)
            },
          }
        : {
            ttlMs: command.ttlMs,
            onExpire: () => {
              command.onExpire(processId)
            },
            environment: command.environment,
          }

    expiryByProcessId.set(
      processId,
      createVisibleLocalSyncFeedbackExpiryHandle(expiryCommand),
    )
  }

  return expiryByProcessId
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

function withoutManyProcessLocalSyncStates(
  currentState: LocalSyncStateByProcessId,
  processIds: readonly string[],
): LocalSyncStateByProcessId {
  let hasChanges = false
  const nextState: Record<string, DashboardLocalSyncStatus> = { ...currentState }

  for (const processId of processIds) {
    if (!(processId in nextState)) continue
    delete nextState[processId]
    hasChanges = true
  }

  return hasChanges ? nextState : currentState
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
    options?: { readonly ttlMs?: number; readonly pauseWhenHidden?: boolean },
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

    command.setLocalSyncState(
      processId,
      localSyncStatus,
      localSyncStatus === 'success'
        ? {
            ttlMs: LOCAL_SYNC_SUCCESS_VISIBLE_TTL_MS,
            pauseWhenHidden: true,
          }
        : {
            ttlMs: LOCAL_SYNC_ERROR_FEEDBACK_TTL_MS,
          },
    )
  }
}

export function useDashboardSyncController(
  command: UseDashboardSyncControllerCommand,
): DashboardSyncControllerResult {
  const { t, keys } = useTranslation()
  const [localSyncStateByProcessId, setLocalSyncStateByProcessId] =
    createSignal<LocalSyncStateByProcessId>({})
  const [syncIssueByProcessId, setSyncIssueByProcessId] = createSignal<SyncIssueByProcessId>({})
  const [dashboardSyncBatchResultState, setDashboardSyncBatchResultState] =
    createSignal<DashboardSyncBatchResultVM | null>(null)
  const [isDashboardSyncBatchResultDismissed, setIsDashboardSyncBatchResultDismissed] =
    createSignal(false)

  const localSyncFeedbackExpiryByProcessId = new Map<string, LocalSyncFeedbackExpiryHandle>()
  let realtimeReconciliationTimeoutId: ReturnType<typeof setTimeout> | null = null
  let realtimeReconciliationInFlight = false
  let pendingRealtimeReconciliation = false

  const clearLocalSyncFeedbackTimer = (processId: string): void => {
    const expiryHandle = localSyncFeedbackExpiryByProcessId.get(processId)
    if (expiryHandle === undefined) return
    expiryHandle.dispose()
    localSyncFeedbackExpiryByProcessId.delete(processId)
  }

  const clearLocalSyncState = (processId: string): void => {
    clearLocalSyncFeedbackTimer(processId)
    setLocalSyncStateByProcessId((previous) => withoutProcessLocalSyncState(previous, processId))
  }

  const clearLocalSyncStates = (processIds: readonly string[]): void => {
    for (const processId of processIds) {
      clearLocalSyncFeedbackTimer(processId)
    }

    setLocalSyncStateByProcessId((previous) =>
      withoutManyProcessLocalSyncStates(previous, processIds),
    )
  }

  const setLocalSyncState = (
    processId: string,
    syncStatus: DashboardLocalSyncStatus,
    options?: { readonly ttlMs?: number; readonly pauseWhenHidden?: boolean },
  ): void => {
    clearLocalSyncFeedbackTimer(processId)
    setLocalSyncStateByProcessId((previous) =>
      withProcessLocalSyncState(previous, processId, syncStatus),
    )

    if (options?.ttlMs === undefined) return

    const expiryHandle = options.pauseWhenHidden
      ? createVisibleLocalSyncFeedbackExpiryHandle({
          ttlMs: options.ttlMs,
          onExpire: () => {
            clearLocalSyncState(processId)
          },
        })
      : createLocalSyncFeedbackExpiryHandle({
          ttlMs: options.ttlMs,
          onExpire: () => {
            clearLocalSyncState(processId)
          },
        })
    localSyncFeedbackExpiryByProcessId.set(processId, expiryHandle)
  }

  const setLocalSyncStates = (
    processIds: readonly string[],
    syncStatus: DashboardLocalSyncStatus,
    options?: { readonly ttlMs?: number; readonly pauseWhenHidden?: boolean },
  ): void => {
    if (processIds.length === 0) return

    for (const processId of processIds) {
      clearLocalSyncFeedbackTimer(processId)
    }

    setLocalSyncStateByProcessId((previous) =>
      withManyProcessLocalSyncStates(previous, processIds, syncStatus),
    )

    if (options?.ttlMs === undefined) return

    const expiryByProcessId = options.pauseWhenHidden
      ? schedulePerProcessVisibleLocalSyncExpiry({
          processIds,
          ttlMs: options.ttlMs,
          onExpire: (processId) => {
            clearLocalSyncState(processId)
          },
        })
      : schedulePerProcessLocalSyncExpiry({
          processIds,
          ttlMs: options.ttlMs,
          onExpire: (processId) => {
            clearLocalSyncState(processId)
          },
        })

    for (const [processId, expiryHandle] of expiryByProcessId.entries()) {
      localSyncFeedbackExpiryByProcessId.set(processId, expiryHandle)
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
    for (const expiryHandle of localSyncFeedbackExpiryByProcessId.values()) {
      expiryHandle.dispose()
    }
    localSyncFeedbackExpiryByProcessId.clear()
  })

  const realtimeSyncStateByProcessId = useProcessSyncRealtime({
    processes: command.allProcesses,
    onRealtimeStateChanged: scheduleRealtimeReconciliation,
  })

  const processesWithSyncFeedback = createMemo(() => {
    const realtimeStateByProcessId = realtimeSyncStateByProcessId()
    const localStateByProcessId = localSyncStateByProcessId()
    const issuesByProcessId = syncIssueByProcessId()

    return command.sortedProcesses().map((process) => {
      const resolvedSyncState = resolveDashboardProcessSyncStatus({
        serverSnapshotState: process.syncStatus,
        realtimeState: realtimeStateByProcessId[process.id] === 'syncing' ? 'syncing' : null,
        localState: localStateByProcessId[process.id] ?? null,
      })
      const syncIssue = issuesByProcessId[process.id] ?? null

      return {
        ...process,
        syncStatus: resolvedSyncState,
        syncIssue,
      }
    })
  })

  const dashboardSyncBatchResult = createMemo(() => {
    if (isDashboardSyncBatchResultDismissed()) {
      return null
    }

    return dashboardSyncBatchResultState()
  })

  const dismissDashboardSyncBatchResult = (): void => {
    setIsDashboardSyncBatchResultDismissed(true)
  }

  const handleDashboardRefresh = async () => {
    const currentProcessIds = command.allProcesses().map((process) => process.id)
    setLocalSyncStates(currentProcessIds, 'syncing')

    try {
      const result = await refreshDashboardData({
        syncAllProcesses: syncAllProcessesRequest,
        refetchProcesses: command.refetchProcesses,
        refetchGlobalAlerts: command.refetchGlobalAlerts,
        refetchDashboardKpis: command.refetchDashboardKpis,
        refetchDashboardProcessesCreatedByMonth: command.refetchDashboardProcessesCreatedByMonth,
      })

      const batchResultVm = toDashboardSyncBatchResultVm({
        source: result,
        t,
        keys,
      })

      setSyncIssueByProcessId(batchResultVm.issueByProcessId)
      setDashboardSyncBatchResultState(batchResultVm)
      setIsDashboardSyncBatchResultDismissed(false)
      clearLocalSyncStates(currentProcessIds)

      const failedProcessIds = new Set(batchResultVm.failedProcessIds)
      const successProcessIds = batchResultVm.enqueuedProcessIds.filter(
        (processId) => !failedProcessIds.has(processId),
      )

      setLocalSyncStates(batchResultVm.failedProcessIds, 'error', {
        ttlMs: LOCAL_SYNC_ERROR_FEEDBACK_TTL_MS,
      })
      setLocalSyncStates(successProcessIds, 'success', {
        ttlMs: LOCAL_SYNC_SUCCESS_VISIBLE_TTL_MS,
        pauseWhenHidden: true,
      })
    } catch (error) {
      setLocalSyncStates(currentProcessIds, 'error', {
        ttlMs: LOCAL_SYNC_ERROR_FEEDBACK_TTL_MS,
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
        ttlMs: LOCAL_SYNC_SUCCESS_VISIBLE_TTL_MS,
        pauseWhenHidden: true,
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
        ttlMs: LOCAL_SYNC_ERROR_FEEDBACK_TTL_MS,
      })
    }
  }

  return {
    processesWithSyncFeedback,
    dashboardSyncBatchResult,
    dismissDashboardSyncBatchResult,
    handleDashboardRefresh,
    handleProcessSync,
  }
}
