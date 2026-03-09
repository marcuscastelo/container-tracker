import { describe, expect, it, vi } from 'vitest'

const agentMonitoringHandlers = vi.hoisted(() => ({
  listAgents: vi.fn(),
  getAgentById: vi.fn(),
  heartbeat: vi.fn(),
}))

vi.mock('~/modules/agent/interface/http/agent-monitoring.controllers.bootstrap', () => ({
  bootstrapAgentMonitoringControllers: () => ({
    listAgents: agentMonitoringHandlers.listAgents,
    getAgentById: agentMonitoringHandlers.getAgentById,
    heartbeat: agentMonitoringHandlers.heartbeat,
  }),
}))

import { POST as heartbeatPost } from '~/routes/api/agent/heartbeat'

describe('agent heartbeat route', () => {
  it('binds POST /api/agent/heartbeat to monitoring controller', () => {
    expect(heartbeatPost).toBe(agentMonitoringHandlers.heartbeat)
  })
})
