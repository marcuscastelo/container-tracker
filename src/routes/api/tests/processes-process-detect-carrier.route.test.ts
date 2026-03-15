import { describe, expect, it, vi } from 'vitest'

const syncHandlers = vi.hoisted(() => ({
  detectCarrierByProcessId: vi.fn(),
}))

vi.mock('~/shared/api/sync.controllers.bootstrap', () => ({
  syncControllers: {
    detectCarrierByProcessId: syncHandlers.detectCarrierByProcessId,
  },
}))

import { POST as detectCarrierPost, runtime } from '~/routes/api/processes/[id]/detect-carrier'

describe('process detect carrier route', () => {
  it('binds POST /api/processes/:id/detect-carrier to sync capability controller', () => {
    expect(detectCarrierPost).toBe(syncHandlers.detectCarrierByProcessId)
    expect(runtime).toBe('nodejs')
  })
})
