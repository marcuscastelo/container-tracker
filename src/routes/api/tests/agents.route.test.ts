import { describe, expect, it, vi } from 'vitest'

const agentMonitoringHandlers = vi.hoisted(() => ({
  listAgents: vi.fn(),
  getAgentById: vi.fn(),
  getAgentLogs: vi.fn(),
  heartbeat: vi.fn(),
  ingestLogs: vi.fn(),
  getUpdateManifest: vi.fn(),
  requestAgentUpdate: vi.fn(),
  requestAgentRestart: vi.fn(),
}))

vi.mock('~/modules/agent/interface/http/agent-monitoring.controllers.bootstrap', () => ({
  bootstrapAgentMonitoringControllers: () => ({
    listAgents: agentMonitoringHandlers.listAgents,
    getAgentById: agentMonitoringHandlers.getAgentById,
    getAgentLogs: agentMonitoringHandlers.getAgentLogs,
    heartbeat: agentMonitoringHandlers.heartbeat,
    ingestLogs: agentMonitoringHandlers.ingestLogs,
    getUpdateManifest: agentMonitoringHandlers.getUpdateManifest,
    requestAgentUpdate: agentMonitoringHandlers.requestAgentUpdate,
    requestAgentRestart: agentMonitoringHandlers.requestAgentRestart,
  }),
}))

import { GET as agentsGet } from '~/routes/api/agents'
import { GET as agentByIdGet } from '~/routes/api/agents/[id]'
import { GET as agentLogsGet } from '~/routes/api/agents/[id]/logs'
import { POST as requestRestartPost } from '~/routes/api/agents/[id]/request-restart'
import { POST as requestUpdatePost } from '~/routes/api/agents/[id]/request-update'

describe('agents monitoring routes', () => {
  it('binds GET /api/agents to listAgents controller', () => {
    expect(agentsGet).toBe(agentMonitoringHandlers.listAgents)
  })

  it('binds GET /api/agents/:id to getAgentById controller', () => {
    expect(agentByIdGet).toBe(agentMonitoringHandlers.getAgentById)
  })

  it('binds GET /api/agents/:id/logs to getAgentLogs controller', () => {
    expect(agentLogsGet).toBe(agentMonitoringHandlers.getAgentLogs)
  })

  it('binds POST /api/agents/:id/request-update to requestAgentUpdate controller', () => {
    expect(requestUpdatePost).toBe(agentMonitoringHandlers.requestAgentUpdate)
  })

  it('binds POST /api/agents/:id/request-restart to requestAgentRestart controller', () => {
    expect(requestRestartPost).toBe(agentMonitoringHandlers.requestAgentRestart)
  })
})
