import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAgentMonitoringControllers } from '~/modules/agent/interface/http/agent-monitoring.controllers'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const AGENT_ID = '22222222-2222-4222-8222-222222222222'

function createDeps() {
  return {
    listAgents: vi.fn(),
    getAgentDetail: vi.fn(),
    getAgentLogs: vi.fn(),
    authenticateAgentToken: vi.fn(),
    touchHeartbeat: vi.fn(),
    ingestAgentLogs: vi.fn(),
    recordActivity: vi.fn(async (_command) => undefined),
    getRemoteControlState: vi.fn(),
    updateAgentRemotePolicy: vi.fn(),
    requestAgentReset: vi.fn(),
    requestAgentUpdate: vi.fn(),
    requestAgentRestart: vi.fn(),
    getUpdateManifestForAgent: vi.fn(),
  }
}

describe('agent monitoring controllers', () => {
  const deps = createDeps()
  const controllers = createAgentMonitoringControllers({
    defaultTenantId: TENANT_ID,
    agentMonitoringUseCases: deps,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    deps.getRemoteControlState.mockResolvedValue({
      policy: {
        desiredVersion: '1.2.3',
        updateChannel: 'stable',
        updatesPaused: false,
        blockedVersions: ['1.0.0'],
        restartRequestedAt: null,
      },
      commands: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          agentId: AGENT_ID,
          tenantId: TENANT_ID,
          type: 'RESTART_AGENT',
          payload: {},
          requestedAt: '2026-04-13T12:00:00.000Z',
        },
      ],
    })
    deps.updateAgentRemotePolicy.mockResolvedValue({ agentId: AGENT_ID })
    deps.requestAgentReset.mockResolvedValue({ agentId: AGENT_ID })
  })

  it('returns control state payload for /api/agents/:id/control-state', async () => {
    const response = await controllers.getAgentControlState({
      params: { id: AGENT_ID },
    })

    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.policy.updateChannel).toBe('stable')
    expect(body.commands[0]?.type).toBe('RESTART_AGENT')
  })

  it('rejects remote policy patch without mutable fields', async () => {
    const response = await controllers.updateAgentRemotePolicy({
      params: { id: AGENT_ID },
      request: new Request(`http://localhost/api/agents/${AGENT_ID}/remote-policy`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'missing policy fields',
        }),
      }),
    })

    expect(response.status).toBe(400)
  })

  it('accepts remote policy patch and records activity reason metadata', async () => {
    const response = await controllers.updateAgentRemotePolicy({
      params: { id: AGENT_ID },
      request: new Request(`http://localhost/api/agents/${AGENT_ID}/remote-policy`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          updates_paused: true,
          blocked_versions: ['1.0.0', '1.0.0', '2.0.0'],
          reason: 'maintenance window',
        }),
      }),
    })

    expect(response.status).toBe(200)
    expect(deps.updateAgentRemotePolicy).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      updatesPaused: true,
      blockedVersions: ['1.0.0', '2.0.0'],
    })
    expect(deps.recordActivity).toHaveBeenCalledTimes(1)
    const activityArg = deps.recordActivity.mock.calls.at(0)?.[0]
    expect(Array.isArray(activityArg)).toBe(true)
  })

  it('requires reason for request-update', async () => {
    const response = await controllers.requestAgentUpdate({
      params: { id: AGENT_ID },
      request: new Request(`http://localhost/api/agents/${AGENT_ID}/request-update`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          desired_version: '1.2.3',
          update_channel: 'stable',
        }),
      }),
    })

    expect(response.status).toBe(400)
  })

  it('requires reason for request-restart', async () => {
    const response = await controllers.requestAgentRestart({
      params: { id: AGENT_ID },
      request: new Request(`http://localhost/api/agents/${AGENT_ID}/request-restart`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),
      }),
    })

    expect(response.status).toBe(400)
  })

  it('requires reason for request-reset', async () => {
    const response = await controllers.requestAgentReset({
      params: { id: AGENT_ID },
      request: new Request(`http://localhost/api/agents/${AGENT_ID}/request-reset`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),
      }),
    })

    expect(response.status).toBe(400)
  })

  it('requests remote reset and records activity with reason', async () => {
    const response = await controllers.requestAgentReset({
      params: { id: AGENT_ID },
      request: new Request(`http://localhost/api/agents/${AGENT_ID}/request-reset`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'recover bad local overrides',
        }),
      }),
    })

    expect(response.status).toBe(200)
    expect(deps.requestAgentReset).toHaveBeenCalled()
    expect(deps.recordActivity).toHaveBeenCalled()
  })
})
