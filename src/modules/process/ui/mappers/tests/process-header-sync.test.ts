import { describe, expect, it } from 'vitest'
import {
  resolveProcessSyncHeaderMode,
  sortProcessSyncHeaderEntries,
} from '~/modules/process/ui/mappers/containerSync.ui-mapper'

describe('process header sync ordering', () => {
  it('orders syncing > error > stale > ok > never', () => {
    const entries = sortProcessSyncHeaderEntries([
      {
        containerNumber: 'MSCU-OK',
        carrier: 'msc',
        sync: {
          containerNumber: 'MSCU-OK',
          carrier: 'msc',
          state: 'ok',
          relativeTimeLabel: '2h ago',
          isStale: false,
        },
      },
      {
        containerNumber: 'MSCU-STALE',
        carrier: 'msc',
        sync: {
          containerNumber: 'MSCU-STALE',
          carrier: 'msc',
          state: 'ok',
          relativeTimeLabel: '2d ago',
          isStale: true,
        },
      },
      {
        containerNumber: 'MSCU-ERROR',
        carrier: 'msc',
        sync: {
          containerNumber: 'MSCU-ERROR',
          carrier: 'msc',
          state: 'error',
          relativeTimeLabel: '10m ago',
          isStale: false,
        },
      },
      {
        containerNumber: 'MSCU-SYNC',
        carrier: 'msc',
        sync: {
          containerNumber: 'MSCU-SYNC',
          carrier: 'msc',
          state: 'syncing',
          relativeTimeLabel: null,
          isStale: false,
        },
      },
      {
        containerNumber: 'MSCU-NEVER',
        carrier: null,
        sync: {
          containerNumber: 'MSCU-NEVER',
          carrier: null,
          state: 'never',
          relativeTimeLabel: null,
          isStale: false,
        },
      },
    ])

    expect(entries.map((entry) => entry.containerNumber)).toEqual([
      'MSCU-SYNC',
      'MSCU-ERROR',
      'MSCU-STALE',
      'MSCU-OK',
      'MSCU-NEVER',
    ])
  })

  it('uses syncing prefix when at least one container is syncing', () => {
    const mode = resolveProcessSyncHeaderMode([
      {
        containerNumber: 'MSCU-SYNC',
        carrier: 'msc',
        sync: {
          containerNumber: 'MSCU-SYNC',
          carrier: 'msc',
          state: 'syncing',
          relativeTimeLabel: null,
          isStale: false,
        },
      },
    ])

    expect(mode).toBe('syncing')
  })

  it('uses updated prefix when none is syncing', () => {
    const mode = resolveProcessSyncHeaderMode([
      {
        containerNumber: 'MSCU-OK',
        carrier: 'msc',
        sync: {
          containerNumber: 'MSCU-OK',
          carrier: 'msc',
          state: 'ok',
          relativeTimeLabel: '1h ago',
          isStale: false,
        },
      },
    ])

    expect(mode).toBe('updated')
  })
})
