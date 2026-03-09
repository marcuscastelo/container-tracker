import { describe, expect, it, vi } from 'vitest'

const syncHandlers = vi.hoisted(() => ({
  syncProcessById: vi.fn(),
}))

vi.mock('~/shared/api/sync.controllers.bootstrap', () => ({
  syncControllers: {
    syncProcessById: syncHandlers.syncProcessById,
  },
}))

import { runtime, POST as syncProcessPost } from '~/routes/api/processes/[id]/sync'

describe('process sync by id route', () => {
  it('binds POST /api/processes/:id/sync to sync capability controller', () => {
    expect(syncProcessPost).toBe(syncHandlers.syncProcessById)
    expect(runtime).toBe('nodejs')
  })
})
