import { describe, expect, it, vi } from 'vitest'

const agentMonitoringHandlers = vi.hoisted(() => ({
  listAgents: vi.fn(),
  getAgentById: vi.fn(),
  heartbeat: vi.fn(),
  getUpdateManifest: vi.fn(),
  requestAgentUpdate: vi.fn(),
  requestAgentRestart: vi.fn(),
}))

vi.mock('~/modules/agent/interface/http/agent-monitoring.controllers.bootstrap', () => ({
  bootstrapAgentMonitoringControllers: () => ({
    listAgents: agentMonitoringHandlers.listAgents,
    getAgentById: agentMonitoringHandlers.getAgentById,
    heartbeat: agentMonitoringHandlers.heartbeat,
    getUpdateManifest: agentMonitoringHandlers.getUpdateManifest,
    requestAgentUpdate: agentMonitoringHandlers.requestAgentUpdate,
    requestAgentRestart: agentMonitoringHandlers.requestAgentRestart,
  }),
}))

import { GET as updateManifestGet } from '~/routes/api/agent/update-manifest'

describe('agent update manifest route', () => {
  it('binds GET /api/agent/update-manifest to getUpdateManifest controller', () => {
    expect(updateManifestGet).toBe(agentMonitoringHandlers.getUpdateManifest)
  })
})
