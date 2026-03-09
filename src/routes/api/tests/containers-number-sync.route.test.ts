import { describe, expect, it, vi } from 'vitest'

const syncHandlers = vi.hoisted(() => ({
  syncContainerByNumber: vi.fn(),
}))

vi.mock('~/shared/api/sync.controllers.bootstrap', () => ({
  syncControllers: {
    syncContainerByNumber: syncHandlers.syncContainerByNumber,
  },
}))

import { runtime, POST as syncContainerPost } from '~/routes/api/containers/[number]/sync'

describe('container sync route', () => {
  it('binds POST /api/containers/:number/sync to sync capability controller', () => {
    expect(syncContainerPost).toBe(syncHandlers.syncContainerByNumber)
    expect(runtime).toBe('nodejs')
  })
})
