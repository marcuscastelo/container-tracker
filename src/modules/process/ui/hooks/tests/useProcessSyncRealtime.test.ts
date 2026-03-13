import { describe, expect, it } from 'vitest'
import {
  deriveProcessSyncStateFromContainerStates,
  pruneUnknownContainers,
  shallowEqualProcessSyncContainerStateMap,
  toProcessSyncStateFromRealtimeStatus,
} from '~/modules/process/ui/hooks/useProcessSyncRealtime'
import {
  type ProcessListItemSource,
  toProcessSummaryVMs,
} from '~/modules/process/ui/mappers/processList.ui-mapper'
import type { ProcessSyncStatus } from '~/modules/process/ui/viewmodels/process-summary.vm'

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
    expect(mapped[0].syncStatus).toBe('idle')
    expect(mapped[1].syncStatus).toBe('idle')
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
