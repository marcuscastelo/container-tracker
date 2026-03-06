import { describe, expect, it, vi } from 'vitest'

const processHandlers = vi.hoisted(() => ({
  syncProcessById: vi.fn(),
}))

vi.mock('~/modules/process/interface/http/process.controllers.bootstrap', () => ({
  processControllers: {
    syncProcessById: processHandlers.syncProcessById,
  },
}))

import { runtime, POST as syncProcessPost } from '~/routes/api/processes/[id]/sync'

describe('process sync by id route', () => {
  it('binds POST /api/processes/:id/sync to process sync controller', () => {
    expect(syncProcessPost).toBe(processHandlers.syncProcessById)
    expect(runtime).toBe('nodejs')
  })
})
