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

import { GET as targetsGet } from '~/routes/api/agent/targets'

describe('agent targets route', () => {
  it('binds GET /api/agent/targets to agent-sync controller', () => {
    expect(targetsGet).toBe(agentSyncHandlers.getTargets)
  })
})
