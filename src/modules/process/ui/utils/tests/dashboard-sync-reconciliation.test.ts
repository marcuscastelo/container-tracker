import { describe, expect, it } from 'vitest'
import { resolveDashboardProcessSyncStatus } from '~/modules/process/ui/utils/dashboard-sync-reconciliation'

describe('resolveDashboardProcessSyncStatus', () => {
  it('keeps server syncing as highest priority', () => {
    expect(
      resolveDashboardProcessSyncStatus({
        serverSnapshotState: 'syncing',
        realtimeState: 'syncing',
        localState: 'success',
      }),
    ).toBe('syncing')
  })

  it('uses realtime syncing when server is idle', () => {
    expect(
      resolveDashboardProcessSyncStatus({
        serverSnapshotState: 'idle',
        realtimeState: 'syncing',
      }),
    ).toBe('syncing')
  })

  it('uses local syncing when server and realtime are idle', () => {
    expect(
      resolveDashboardProcessSyncStatus({
        serverSnapshotState: 'idle',
        localState: 'syncing',
      }),
    ).toBe('syncing')
  })

  it('uses local success/error as transient feedback when no sync is active', () => {
    expect(
      resolveDashboardProcessSyncStatus({
        serverSnapshotState: 'idle',
        localState: 'success',
      }),
    ).toBe('success')

    expect(
      resolveDashboardProcessSyncStatus({
        serverSnapshotState: 'idle',
        localState: 'error',
      }),
    ).toBe('error')
  })

  it('falls back to idle when no source reports active/feedback state', () => {
    expect(
      resolveDashboardProcessSyncStatus({
        serverSnapshotState: 'idle',
      }),
    ).toBe('idle')
  })
})
