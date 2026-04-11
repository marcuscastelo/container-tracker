import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const subscribeToSyncRequestsRealtimeByContainerRefsMock = vi.hoisted(() => vi.fn())

vi.mock('solid-js', async () => vi.importActual('solid-js/dist/solid.js'))

vi.mock('~/shared/api/sync-requests.realtime.client', () => ({
  subscribeToSyncRequestsRealtimeByContainerRefs:
    subscribeToSyncRequestsRealtimeByContainerRefsMock,
}))

import { createRoot, createSignal } from 'solid-js'
import {
  deriveProcessSyncStateFromContainerStates,
  pruneUnknownContainers,
  shallowEqualProcessSyncContainerStateMap,
  toProcessSyncStateFromRealtimeStatus,
  useProcessSyncRealtime,
} from '~/modules/process/ui/hooks/useProcessSyncRealtime'
import {
  type ProcessListItemSource,
  toProcessSummaryVMs,
} from '~/modules/process/ui/mappers/processList.ui-mapper'
import type {
  ProcessSummaryVM,
  ProcessSyncStatus,
} from '~/modules/process/ui/viewmodels/process-summary.vm'
import type { SyncRequestRealtimeEvent } from '~/shared/api/sync-requests.realtime.client'

type SubscribeByContainerRefsCommand = {
  readonly containerNumbers: readonly string[]
  readonly onEvent: (event: SyncRequestRealtimeEvent) => void
}

type RecordedRealtimeSubscription = {
  readonly containerNumbers: readonly string[]
  readonly onEvent: (event: SyncRequestRealtimeEvent) => void
  readonly unsubscribe: ReturnType<typeof vi.fn>
}

function createProcessSyncContainerStateMap(
  input: Readonly<Record<string, Readonly<Record<string, ProcessSyncStatus>>>>,
): ReadonlyMap<string, ReadonlyMap<string, ProcessSyncStatus>> {
  return new Map(
    Object.entries(input).map(([processId, containerStates]) => [
      processId,
      new Map(Object.entries(containerStates)),
    ]),
  )
}

function requireAt<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) {
    throw new Error(`Expected item at index ${index}`)
  }
  return item
}

function buildProcess(command: {
  readonly id: string
  readonly containerNumbers: readonly string[]
}): ProcessSummaryVM {
  return {
    id: command.id,
    reference: `REF-${command.id}`,
    origin: {
      display_name: 'Shanghai',
    },
    destination: {
      display_name: 'Santos',
    },
    importerId: null,
    importerName: null,
    exporterName: null,
    containerCount: command.containerNumbers.length,
    containerNumbers: command.containerNumbers,
    status: 'in-transit',
    statusCode: 'IN_TRANSIT',
    statusMicrobadge: null,
    statusRank: 1,
    eta: null,
    etaDisplay: {
      kind: 'unavailable',
    },
    etaMsOrNull: null,
    carrier: 'MSC',
    alertsCount: 0,
    highestAlertSeverity: null,
    attentionSeverity: null,
    dominantAlertCreatedAt: null,
    trackingValidation: {
      hasIssues: false,
      highestSeverity: null,
      affectedContainerCount: 0,
      topIssue: null,
    },
    redestinationNumber: null,
    hasTransshipment: false,
    lastEventAt: null,
    syncStatus: 'idle',
    lastSyncAt: null,
  }
}

function buildRealtimeEvent(command: {
  readonly status: 'PENDING' | 'DONE' | 'FAILED'
  readonly refValue: string
}): SyncRequestRealtimeEvent {
  return {
    eventType: 'UPDATE',
    row: {
      id: '11111111-1111-1111-1111-111111111111',
      tenant_id: '22222222-2222-2222-2222-222222222222',
      status: command.status,
      last_error: null,
      updated_at: '2026-04-11T12:00:00.000Z',
      ref_value: command.refValue,
      leased_by: null,
      leased_until: null,
    },
    oldRow: null,
  }
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function createHookHarness(command: {
  readonly initialProcesses: readonly ProcessSummaryVM[]
  readonly onRealtimeStateChanged?: () => void
}) {
  return createRoot((dispose) => {
    const [processes, setProcesses] = createSignal(command.initialProcesses)
    const onRealtimeStateChanged = command.onRealtimeStateChanged ?? vi.fn()
    const processSyncStates = useProcessSyncRealtime({
      processes,
      onRealtimeStateChanged,
    })

    return {
      processSyncStates,
      setProcesses,
      onRealtimeStateChanged,
      dispose,
    }
  })
}

describe('useProcessSyncRealtime helpers', () => {
  it('maps RUNNING-like realtime statuses to syncing', () => {
    expect(toProcessSyncStateFromRealtimeStatus('RUNNING')).toBe('syncing')
    expect(toProcessSyncStateFromRealtimeStatus('PENDING')).toBe('syncing')
    expect(toProcessSyncStateFromRealtimeStatus('LEASED')).toBe('syncing')
  })

  it('ignores terminal realtime statuses for direct row-state derivation', () => {
    expect(toProcessSyncStateFromRealtimeStatus('DONE')).toBeNull()
    expect(toProcessSyncStateFromRealtimeStatus('FAILED')).toBeNull()
    expect(toProcessSyncStateFromRealtimeStatus('NOT_FOUND')).toBeNull()
  })

  it('keeps idle as the default derived state when no container status is active', () => {
    expect(deriveProcessSyncStateFromContainerStates([])).toBe('idle')
    expect(deriveProcessSyncStateFromContainerStates(['idle'])).toBe('idle')
  })

  it('resets persisted DONE/FAILED states to idle after reload via dashboard base mapping', () => {
    const source: ProcessListItemSource[] = [
      {
        id: 'process-done',
        source: 'api',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        containers: [{ id: 'c-1', container_number: 'MSCU1234567', carrier_code: 'MSC' }],
        last_sync_status: 'DONE',
      },
      {
        id: 'process-failed',
        source: 'api',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        containers: [{ id: 'c-2', container_number: 'MRKU7654321', carrier_code: 'MAERSK' }],
        last_sync_status: 'FAILED',
      },
    ]

    const mapped = toProcessSummaryVMs(source)
    expect(requireAt(mapped, 0).syncStatus).toBe('idle')
    expect(requireAt(mapped, 1).syncStatus).toBe('idle')
  })

  it('treats unchanged pruned process sync state as shallowly equal', () => {
    const currentState = createProcessSyncContainerStateMap({
      'process-1': {
        MSCU1234567: 'syncing',
      },
    })

    const prunedState = pruneUnknownContainers({
      stateByProcessId: currentState,
      containerToProcessId: new Map([['MSCU1234567', 'process-1']]),
    })

    expect(prunedState).toEqual(currentState)
    expect(shallowEqualProcessSyncContainerStateMap(currentState, prunedState)).toBe(true)
  })

  it('detects removed process entries after pruning unknown containers', () => {
    const currentState = createProcessSyncContainerStateMap({
      'process-1': {
        MSCU1234567: 'syncing',
      },
      'process-2': {
        MRKU7654321: 'error',
      },
    })

    const prunedState = pruneUnknownContainers({
      stateByProcessId: currentState,
      containerToProcessId: new Map([['MSCU1234567', 'process-1']]),
    })

    expect(shallowEqualProcessSyncContainerStateMap(currentState, prunedState)).toBe(false)
    expect(prunedState).toEqual(
      createProcessSyncContainerStateMap({
        'process-1': {
          MSCU1234567: 'syncing',
        },
      }),
    )
  })

  it('detects shallow child-state changes even when process keys are unchanged', () => {
    const currentState = createProcessSyncContainerStateMap({
      'process-1': {
        MSCU1234567: 'syncing',
      },
    })

    const nextState = createProcessSyncContainerStateMap({
      'process-1': {
        MSCU1234567: 'success',
      },
    })

    expect(shallowEqualProcessSyncContainerStateMap(currentState, nextState)).toBe(false)
  })
})

describe('useProcessSyncRealtime behavior', () => {
  let subscriptions: RecordedRealtimeSubscription[]

  beforeEach(() => {
    vi.useFakeTimers()
    subscriptions = []
    subscribeToSyncRequestsRealtimeByContainerRefsMock.mockReset()
    subscribeToSyncRequestsRealtimeByContainerRefsMock.mockImplementation(
      (command: SubscribeByContainerRefsCommand) => {
        const unsubscribe = vi.fn()
        subscriptions.push({
          containerNumbers: command.containerNumbers,
          onEvent: command.onEvent,
          unsubscribe,
        })

        return { unsubscribe }
      },
    )
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('marks a process as syncing from realtime and reconciles after terminal events', async () => {
    const onRealtimeStateChanged = vi.fn()
    const harness = createHookHarness({
      initialProcesses: [buildProcess({ id: 'process-1', containerNumbers: [' mscu1234567 '] })],
      onRealtimeStateChanged,
    })

    await flushAsyncWork()

    expect(subscriptions).toHaveLength(1)
    expect(subscriptions[0]?.containerNumbers).toEqual(['MSCU1234567'])

    subscriptions[0]?.onEvent(buildRealtimeEvent({ status: 'PENDING', refValue: 'mscu1234567' }))
    await flushAsyncWork()

    expect(harness.processSyncStates()).toEqual({
      'process-1': 'syncing',
    })

    subscriptions[0]?.onEvent(buildRealtimeEvent({ status: 'DONE', refValue: 'MSCU1234567' }))
    await flushAsyncWork()

    expect(harness.processSyncStates()).toEqual({})
    expect(onRealtimeStateChanged).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(250)

    expect(onRealtimeStateChanged).toHaveBeenCalledTimes(1)

    harness.dispose()
    expect(subscriptions[0]?.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('still reconciles terminal events even when no local realtime state changed', async () => {
    const onRealtimeStateChanged = vi.fn()
    const harness = createHookHarness({
      initialProcesses: [buildProcess({ id: 'process-1', containerNumbers: ['MSCU1234567'] })],
      onRealtimeStateChanged,
    })

    await flushAsyncWork()

    subscriptions[0]?.onEvent(buildRealtimeEvent({ status: 'FAILED', refValue: 'MSCU1234567' }))
    await flushAsyncWork()

    expect(harness.processSyncStates()).toEqual({})

    await vi.advanceTimersByTimeAsync(250)

    expect(onRealtimeStateChanged).toHaveBeenCalledTimes(1)
    harness.dispose()
  })

  it('prunes stale container state and resubscribes when tracked containers change', async () => {
    const harness = createHookHarness({
      initialProcesses: [buildProcess({ id: 'process-1', containerNumbers: ['MSCU1234567'] })],
    })

    await flushAsyncWork()

    subscriptions[0]?.onEvent(buildRealtimeEvent({ status: 'PENDING', refValue: 'MSCU1234567' }))
    await flushAsyncWork()

    expect(harness.processSyncStates()).toEqual({
      'process-1': 'syncing',
    })

    harness.setProcesses([buildProcess({ id: 'process-1', containerNumbers: ['MRKU7654321'] })])
    await flushAsyncWork()

    expect(subscriptions).toHaveLength(2)
    expect(subscriptions[0]?.unsubscribe).toHaveBeenCalledTimes(1)
    expect(subscriptions[1]?.containerNumbers).toEqual(['MRKU7654321'])
    expect(harness.processSyncStates()).toEqual({})

    harness.dispose()
    expect(subscriptions[1]?.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
