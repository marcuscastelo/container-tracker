import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js'
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
  if (status === 'DONE') return 'success'
  if (status === 'FAILED' || status === 'NOT_FOUND') return 'error'
  return null
}

export function toTrackedContainerNumberFromSyncRealtimeEvent(
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

function pruneUnknownContainers(command: {
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

export function useProcessSyncRealtime(command: {
  readonly processes: Accessor<readonly ProcessSummaryVM[]>
}): Accessor<Readonly<Record<string, ProcessSyncStatus>>> {
  const [stateByProcessId, setStateByProcessId] = createSignal<ProcessSyncContainerStateMap>(
    new Map(),
  )
  const [processSyncStates, setProcessSyncStates] = createSignal<Readonly<
    Record<string, ProcessSyncStatus>
  >>({})

  let activeRealtimeCleanup: (() => void) | null = null

  createEffect(() => {
    const processes = command.processes()
    const containerToProcessId = toContainerToProcessIdMap(processes)

    const prunedState = pruneUnknownContainers({
      stateByProcessId: stateByProcessId(),
      containerToProcessId,
    })
    setStateByProcessId(prunedState)
    setProcessSyncStates(toProcessSyncStateRecord(prunedState))

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
        const realtimeState = toProcessSyncStateFromRealtimeStatus(row?.status)
        if (realtimeState === null) return

        const nextStateByProcessId = setContainerRealtimeState({
          stateByProcessId: stateByProcessId(),
          processId,
          containerNumber,
          nextState: realtimeState,
        })

        setStateByProcessId(nextStateByProcessId)
        setProcessSyncStates(toProcessSyncStateRecord(nextStateByProcessId))
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
    if (activeRealtimeCleanup) {
      activeRealtimeCleanup()
      activeRealtimeCleanup = null
    }
  })

  return processSyncStates
}
