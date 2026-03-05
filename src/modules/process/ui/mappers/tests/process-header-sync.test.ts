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
          relativeTimeAt: '2026-03-03T08:00:00.000Z',
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
          relativeTimeAt: '2026-03-01T10:00:00.000Z',
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
          relativeTimeAt: '2026-03-03T09:50:00.000Z',
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
          relativeTimeAt: null,
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
          relativeTimeAt: null,
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
          relativeTimeAt: null,
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
          relativeTimeAt: '2026-03-03T09:00:00.000Z',
          isStale: false,
        },
      },
    ])

    expect(mode).toBe('updated')
  })
})
