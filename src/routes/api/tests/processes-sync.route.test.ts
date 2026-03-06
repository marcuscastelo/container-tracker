import { describe, expect, it, vi } from 'vitest'

const processHandlers = vi.hoisted(() => ({
  syncAllProcesses: vi.fn(),
}))

vi.mock('~/modules/process/interface/http/process.controllers.bootstrap', () => ({
  processControllers: {
    syncAllProcesses: processHandlers.syncAllProcesses,
  },
}))

import { runtime, POST as syncProcessesPost } from '~/routes/api/processes/sync'

describe('processes sync route', () => {
  it('binds POST /api/processes/sync to process sync controller', () => {
    expect(syncProcessesPost).toBe(processHandlers.syncAllProcesses)
    expect(runtime).toBe('nodejs')
  })
})
