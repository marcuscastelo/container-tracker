import { describe, expect, it, vi } from 'vitest'

const agentSyncHandlers = vi.hoisted(() => ({
  getTargets: vi.fn(),
  ingestSnapshot: vi.fn(),
}))

vi.mock('~/modules/tracking/interface/http/agent-sync.controllers.bootstrap', () => ({
  bootstrapAgentSyncControllers: () => ({
    getTargets: agentSyncHandlers.getTargets,
    ingestSnapshot: agentSyncHandlers.ingestSnapshot,
  }),
}))

import { POST as ingestPost } from '~/routes/api/tracking/snapshots/ingest'

describe('snapshot ingest route', () => {
  it('binds POST /api/tracking/snapshots/ingest to agent-sync controller', () => {
    expect(ingestPost).toBe(agentSyncHandlers.ingestSnapshot)
  })
})
