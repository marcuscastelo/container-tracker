import { describe, expect, it } from 'vitest'
import {
  deriveProcessSyncStateFromContainerStates,
  toProcessSyncStateFromRealtimeStatus,
} from '~/modules/process/ui/hooks/useProcessSyncRealtime'
import { toProcessSummaryVMs, type ProcessListItemSource } from '~/modules/process/ui/mappers/processList.ui-mapper'

describe('useProcessSyncRealtime helpers', () => {
  it('maps RUNNING-like realtime statuses to syncing', () => {
    expect(toProcessSyncStateFromRealtimeStatus('RUNNING')).toBe('syncing')
    expect(toProcessSyncStateFromRealtimeStatus('PENDING')).toBe('syncing')
    expect(toProcessSyncStateFromRealtimeStatus('LEASED')).toBe('syncing')
  })

  it('maps DONE status to success', () => {
    expect(toProcessSyncStateFromRealtimeStatus('DONE')).toBe('success')
  })

  it('maps FAILED/NOT_FOUND statuses to error', () => {
    expect(toProcessSyncStateFromRealtimeStatus('FAILED')).toBe('error')
    expect(toProcessSyncStateFromRealtimeStatus('NOT_FOUND')).toBe('error')
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
        lastSyncStatus: 'DONE',
      },
      {
        id: 'process-failed',
        source: 'api',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        containers: [{ id: 'c-2', container_number: 'MRKU7654321', carrier_code: 'MAERSK' }],
        lastSyncStatus: 'FAILED',
      },
    ]

    const mapped = toProcessSummaryVMs(source)
    expect(mapped[0].syncStatus).toBe('idle')
    expect(mapped[1].syncStatus).toBe('idle')
  })
})
