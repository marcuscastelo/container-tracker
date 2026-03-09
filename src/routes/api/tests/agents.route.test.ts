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

import { GET as agentsGet } from '~/routes/api/agents'
import { GET as agentByIdGet } from '~/routes/api/agents/[id]'

describe('agents monitoring routes', () => {
  it('binds GET /api/agents to listAgents controller', () => {
    expect(agentsGet).toBe(agentMonitoringHandlers.listAgents)
  })

  it('binds GET /api/agents/:id to getAgentById controller', () => {
    expect(agentByIdGet).toBe(agentMonitoringHandlers.getAgentById)
  })
})
