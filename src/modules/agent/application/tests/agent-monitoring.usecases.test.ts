import { describe, expect, it, vi } from 'vitest'
import type { AgentMonitoringRepository } from '~/modules/agent/application/agent-monitoring.repository'
import { createAgentMonitoringUseCases } from '~/modules/agent/application/agent-monitoring.usecases'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const AGENT_ID = '22222222-2222-4222-8222-222222222222'

function createRepository(): AgentMonitoringRepository {
  return {
    listAgentsForTenant: vi.fn(async () => []),
    getAgentDetailForTenant: vi.fn(async () => null),
    listActivityEventsForAgentsSince: vi.fn(async () => []),
    listRecentActivityForAgent: vi.fn(async () => []),
    listRecentLogsForAgent: vi.fn(async () => []),
    getTenantQueueLagSeconds: vi.fn(async () => null),
    authenticateAgentToken: vi.fn(async () => null),
    updateAgentRuntimeState: vi.fn(async () => null),
    getRemoteControlState: vi.fn(async () => null),
    getInfraConfig: vi.fn(async () => null),
    acknowledgeRemoteControlCommand: vi.fn(async () => false),
    requestAgentUpdate: vi.fn(async () => null),
    updateAgentRemotePolicy: vi.fn(async () => null),
    requestAgentRestart: vi.fn(async () => null),
    requestAgentReset: vi.fn(async () => null),
    insertActivityEvents: vi.fn(async () => undefined),
    insertLogEvents: vi.fn(async () => ({ accepted: 0, persisted: 0 })),
  }
}

describe('agent monitoring usecases - remote control extensions', () => {
  it('forwards remote policy patch with desiredVersion null for clear action', async () => {
    const repository = createRepository()
    const useCases = createAgentMonitoringUseCases({ repository })

    await useCases.updateAgentRemotePolicy({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      desiredVersion: null,
      blockedVersions: ['1.0.0'],
    })

    expect(repository.updateAgentRemotePolicy).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      desiredVersion: null,
      blockedVersions: ['1.0.0'],
    })
  })

  it('forwards remote reset request with explicit timestamp', async () => {
    const repository = createRepository()
    const useCases = createAgentMonitoringUseCases({ repository })
    const requestedAt = '2026-04-13T12:00:00.000Z'

    await useCases.requestAgentReset({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      requestedAt,
    })

    expect(repository.requestAgentReset).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      requestedAt,
    })
  })
})
