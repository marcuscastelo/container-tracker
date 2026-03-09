import { describe, expect, it, vi } from 'vitest'

const syncHandlers = vi.hoisted(() => ({
  syncAllProcesses: vi.fn(),
}))

vi.mock('~/shared/api/sync.controllers.bootstrap', () => ({
  syncControllers: {
    syncAllProcesses: syncHandlers.syncAllProcesses,
  },
}))

import { runtime, POST as syncProcessesPost } from '~/routes/api/processes/sync'

describe('processes sync route', () => {
  it('binds POST /api/processes/sync to sync capability controller', () => {
    expect(syncProcessesPost).toBe(syncHandlers.syncAllProcesses)
    expect(runtime).toBe('nodejs')
  })
})
