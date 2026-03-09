import { describe, expect, it, vi } from 'vitest'

const syncStatusHandlers = vi.hoisted(() => ({
  listProcessesSyncStatus: vi.fn(),
}))

vi.mock('~/shared/api/sync.controllers.bootstrap', () => ({
  syncStatusControllers: {
    listProcessesSyncStatus: syncStatusHandlers.listProcessesSyncStatus,
  },
}))

import { GET as processesSyncStatusGet } from '~/routes/api/processes/sync-status'

describe('processes sync-status route', () => {
  it('binds GET /api/processes/sync-status to sync-status capability controller', () => {
    expect(processesSyncStatusGet).toBe(syncStatusHandlers.listProcessesSyncStatus)
  })
})
