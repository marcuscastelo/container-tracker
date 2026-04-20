import { type Accessor, createEffect, createSignal, onCleanup, untrack } from 'solid-js'
import { normalizeContainerNumber } from '~/modules/process/ui/mappers/containerSync.ui-mapper'
import type {
  ProcessSummaryVM,
  ProcessSyncStatus,
} from '~/modules/process/ui/viewmodels/process-summary.vm'
import {
  type SyncRequestRealtimeEvent,
  subscribeToSyncRequestsRealtimeByContainerRefs,
} from '~/shared/api/sync-requests.realtime.client'

type ProcessSyncContainerStateMap = ReadonlyMap<string, ReadonlyMap<string, ProcessSyncStatus>>
const REALTIME_RECONCILIATION_DEBOUNCE_MS = 250

function toMutableProcessSyncContainerStateMap(
  input: ProcessSyncContainerStateMap,
): Map<string, Map<string, ProcessSyncStatus>> {
  const next = new Map<string, Map<string, ProcessSyncStatus>>()
  for (const [processId, containerMap] of input.entries()) {
    next.set(processId, new Map(containerMap))
  }
  return next
}

function toProcessSyncStateRecord(
  stateByProcessId: ReadonlyMap<string, ReadonlyMap<string, ProcessSyncStatus>>,
): Readonly<Record<string, ProcessSyncStatus>> {
  const out: Record<string, ProcessSyncStatus> = {}

  for (const [processId, containerStates] of stateByProcessId.entries()) {
    const resolvedState = deriveProcessSyncStateFromContainerStates([...containerStates.values()])
    if (resolvedState === 'idle') continue
    out[processId] = resolvedState
  }

  return out
}

function toContainerToProcessIdMap(
  processes: readonly ProcessSummaryVM[],
): ReadonlyMap<string, string> {
  const map = new Map<string, string>()

  for (const process of processes) {
    for (const containerNumber of process.containerNumbers) {
      map.set(normalizeContainerNumber(containerNumber), process.id)
    }
  }

  return map
}

export function toProcessSyncStateFromRealtimeStatus(
  status: string | null | undefined,
): ProcessSyncStatus | null {
  if (status === 'PENDING' || status === 'LEASED' || status === 'RUNNING') return 'syncing'
  return null
}

function isTerminalRealtimeStatus(status: string | null | undefined): boolean {
  return status === 'DONE' || status === 'FAILED' || status === 'NOT_FOUND'
}

function toTrackedContainerNumberFromSyncRealtimeEvent(
  event: SyncRequestRealtimeEvent,
): string | null {
  const row = event.row ?? event.oldRow
  if (!row?.ref_value) return null
  return normalizeContainerNumber(row.ref_value)
}

export function deriveProcessSyncStateFromContainerStates(
  states: readonly ProcessSyncStatus[],
): ProcessSyncStatus {
  if (states.some((state) => state === 'syncing')) return 'syncing'
  if (states.some((state) => state === 'error')) return 'error'
  if (states.some((state) => state === 'success')) return 'success'
  return 'idle'
}

export function shallowEqualProcessSyncContainerStateMap(
  left: ProcessSyncContainerStateMap,
  right: ProcessSyncContainerStateMap,
): boolean {
  if (left === right) return true
  if (left.size !== right.size) return false

  for (const [processId, leftContainerStates] of left.entries()) {
    const rightContainerStates = right.get(processId)
    if (rightContainerStates === undefined) return false
    if (leftContainerStates === rightContainerStates) continue
    if (leftContainerStates.size !== rightContainerStates.size) return false

    for (const [containerNumber, leftState] of leftContainerStates.entries()) {
      if (rightContainerStates.get(containerNumber) !== leftState) {
        return false
      }
    }
  }

  return true
}

export function pruneUnknownContainers(command: {
  readonly stateByProcessId: ProcessSyncContainerStateMap
  readonly containerToProcessId: ReadonlyMap<string, string>
}): ProcessSyncContainerStateMap {
  const next = new Map<string, Map<string, ProcessSyncStatus>>()

  for (const [processId, containerStates] of command.stateByProcessId.entries()) {
    const nextContainerStates = new Map<string, ProcessSyncStatus>()

    for (const [containerNumber, state] of containerStates.entries()) {
      if (command.containerToProcessId.get(containerNumber) !== processId) {
        continue
      }
      nextContainerStates.set(containerNumber, state)
    }

    if (nextContainerStates.size > 0) {
      next.set(processId, nextContainerStates)
    }
  }

  return next
}

function setContainerRealtimeState(command: {
  readonly stateByProcessId: ProcessSyncContainerStateMap
  readonly processId: string
  readonly containerNumber: string
  readonly nextState: ProcessSyncStatus
}): ProcessSyncContainerStateMap {
  const next = toMutableProcessSyncContainerStateMap(command.stateByProcessId)
  const currentProcessStates = next.get(command.processId) ?? new Map<string, ProcessSyncStatus>()
  currentProcessStates.set(command.containerNumber, command.nextState)
  next.set(command.processId, currentProcessStates)
  return next
}

function clearContainerRealtimeState(command: {
  readonly stateByProcessId: ProcessSyncContainerStateMap
  readonly processId: string
  readonly containerNumber: string
}): ProcessSyncContainerStateMap {
  const currentProcessStates = command.stateByProcessId.get(command.processId)
  if (!currentProcessStates) return command.stateByProcessId

  if (!currentProcessStates.has(command.containerNumber)) {
    return command.stateByProcessId
  }

  const next = toMutableProcessSyncContainerStateMap(command.stateByProcessId)
  const nextProcessStates = next.get(command.processId)
  if (!nextProcessStates) return command.stateByProcessId

  nextProcessStates.delete(command.containerNumber)
  if (nextProcessStates.size === 0) {
    next.delete(command.processId)
    return next
  }

  next.set(command.processId, nextProcessStates)
  return next
}

export function useProcessSyncRealtime(command: {
  readonly processes: Accessor<readonly ProcessSummaryVM[]>
  readonly onRealtimeStateChanged?: () => void
}): Accessor<Readonly<Record<string, ProcessSyncStatus>>> {
  const [stateByProcessId, setStateByProcessId] = createSignal<ProcessSyncContainerStateMap>(
    new Map(),
  )
  const [processSyncStates, setProcessSyncStates] = createSignal<
    Readonly<Record<string, ProcessSyncStatus>>
  >({})

  let activeRealtimeCleanup: (() => void) | null = null
  let reconciliationTimeoutId: ReturnType<typeof setTimeout> | null = null

  const clearScheduledReconciliation = (): void => {
    if (reconciliationTimeoutId === null) return
    clearTimeout(reconciliationTimeoutId)
    reconciliationTimeoutId = null
  }

  const scheduleReconciliation = (): void => {
    if (!command.onRealtimeStateChanged) return
    clearScheduledReconciliation()
    reconciliationTimeoutId = setTimeout(() => {
      reconciliationTimeoutId = null
      command.onRealtimeStateChanged?.()
    }, REALTIME_RECONCILIATION_DEBOUNCE_MS)
  }

  createEffect(() => {
    const processes = command.processes()
    const containerToProcessId = toContainerToProcessIdMap(processes)

    // Read current state without creating a reactive dependency on it to avoid
    // the effect re-running when we setStateByProcessId below.
    const currentState = untrack(() => stateByProcessId())
    const prunedState = pruneUnknownContainers({
      stateByProcessId: currentState,
      containerToProcessId,
    })

    if (!shallowEqualProcessSyncContainerStateMap(currentState, prunedState)) {
      setStateByProcessId(prunedState)
      queueMicrotask(() => setProcessSyncStates(toProcessSyncStateRecord(prunedState)))
    }

    if (activeRealtimeCleanup) {
      activeRealtimeCleanup()
      activeRealtimeCleanup = null
    }

    const trackedContainerNumbers = [...containerToProcessId.keys()]
    if (trackedContainerNumbers.length === 0) {
      return
    }

    const subscription = subscribeToSyncRequestsRealtimeByContainerRefs({
      containerNumbers: trackedContainerNumbers,
      onEvent(event) {
        const containerNumber = toTrackedContainerNumberFromSyncRealtimeEvent(event)
        if (!containerNumber) return

        const processId = containerToProcessId.get(containerNumber)
        if (!processId) return

        const row = event.row ?? event.oldRow
        const currentStateByProcessId = stateByProcessId()
        const realtimeState = toProcessSyncStateFromRealtimeStatus(row?.status)
        const nextStateByProcessId = (() => {
          if (realtimeState === 'syncing') {
            return setContainerRealtimeState({
              stateByProcessId: currentStateByProcessId,
              processId,
              containerNumber,
              nextState: realtimeState,
            })
          }

          if (isTerminalRealtimeStatus(row?.status)) {
            return clearContainerRealtimeState({
              stateByProcessId: currentStateByProcessId,
              processId,
              containerNumber,
            })
          }

          return currentStateByProcessId
        })()

        if (nextStateByProcessId === currentStateByProcessId) {
          // Even if the realtime state map doesn't change, terminal events should still
          // trigger reconciliation to ensure we refetch the latest server snapshot.
          if (isTerminalRealtimeStatus(row?.status)) {
            scheduleReconciliation()
          }
          return
        }

        setStateByProcessId(nextStateByProcessId)
        // Defer update to break potential synchronous cycles
        queueMicrotask(() => setProcessSyncStates(toProcessSyncStateRecord(nextStateByProcessId)))
        scheduleReconciliation()
      },
    })

    activeRealtimeCleanup = subscription.unsubscribe
    onCleanup(() => {
      if (activeRealtimeCleanup) {
        activeRealtimeCleanup()
        activeRealtimeCleanup = null
      }
    })
  })

  onCleanup(() => {
    clearScheduledReconciliation()
    if (activeRealtimeCleanup) {
      activeRealtimeCleanup()
      activeRealtimeCleanup = null
    }
  })

  return processSyncStates
}
