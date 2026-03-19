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

import { POST as heartbeatPost } from '~/routes/api/agent/heartbeat'
import { POST as ingestLogsPost } from '~/routes/api/agent/logs'

describe('agent heartbeat route', () => {
  it('binds POST /api/agent/heartbeat to monitoring controller', () => {
    expect(heartbeatPost).toBe(agentMonitoringHandlers.heartbeat)
  })

  it('binds POST /api/agent/logs to monitoring controller', () => {
    expect(ingestLogsPost).toBe(agentMonitoringHandlers.ingestLogs)
  })
})
