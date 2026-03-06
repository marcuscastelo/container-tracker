import { describe, expect, it, vi } from 'vitest'

const processHandlers = vi.hoisted(() => ({
  refreshProcessById: vi.fn(),
}))

vi.mock('~/modules/process/interface/http/process.controllers.bootstrap', () => ({
  processControllers: {
    refreshProcessById: processHandlers.refreshProcessById,
  },
}))

import { POST as processRefreshPost, runtime } from '~/routes/api/processes/[id]/refresh'

describe('process refresh by id route', () => {
  it('binds POST /api/processes/:id/refresh to process refresh controller', () => {
    expect(processRefreshPost).toBe(processHandlers.refreshProcessById)
    expect(runtime).toBe('nodejs')
  })
})
