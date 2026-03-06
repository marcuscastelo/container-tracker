import { describe, expect, it, vi } from 'vitest'

const processHandlers = vi.hoisted(() => ({
  listProcessesSyncStatus: vi.fn(),
}))

vi.mock('~/modules/process/interface/http/process.controllers.bootstrap', () => ({
  processControllers: {
    listProcessesSyncStatus: processHandlers.listProcessesSyncStatus,
  },
}))

import { GET as processesSyncStatusGet } from '~/routes/api/processes/sync-status'

describe('processes sync-status route', () => {
  it('binds GET /api/processes/sync-status to process sync-status controller', () => {
    expect(processesSyncStatusGet).toBe(processHandlers.listProcessesSyncStatus)
  })
})
