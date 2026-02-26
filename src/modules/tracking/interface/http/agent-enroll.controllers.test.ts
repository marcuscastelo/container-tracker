import { describe, expect, it, vi } from 'vitest'

import {
  type AgentEnrollControllersDeps,
  createAgentEnrollControllers,
} from '~/modules/tracking/interface/http/agent-enroll.controllers'
import { AgentEnrollResponseSchema } from '~/modules/tracking/interface/http/agent-enroll.schemas'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

function createDeps(
  overrides: Partial<AgentEnrollControllersDeps> = {},
): AgentEnrollControllersDeps {
  return {
    findInstallerTokenByHash: vi.fn(async ({ tokenHash }) => ({
      tenantId: TENANT_ID,
      tokenHash,
      revokedAt: null,
      expiresAt: null,
    })),
    findAgentByFingerprint: vi.fn(async () => null),
    createAgent: vi.fn(async () => ({
      id: 'agent-1',
      tenantId: TENANT_ID,
      machineFingerprint: 'fingerprint-1',
      hostname: 'host-1',
      os: 'windows',
      agentVersion: '0.1.0',
      agentToken: 'agent-token-1',
      intervalSec: 60,
      limit: 10,
      supabaseUrl: null,
      supabaseAnonKey: null,
      maerskEnabled: false,
      maerskHeadless: true,
      maerskTimeoutMs: 120000,
      maerskUserDataDir: null,
    })),
    updateAgentEnrollmentMetadata: vi.fn(async () => ({
      id: 'agent-1',
      tenantId: TENANT_ID,
      machineFingerprint: 'fingerprint-1',
      hostname: 'host-1',
      os: 'windows',
      agentVersion: '0.1.1',
      agentToken: 'agent-token-existing',
      intervalSec: 30,
      limit: 25,
      supabaseUrl: 'https://supabase.test',
      supabaseAnonKey: 'anon',
      maerskEnabled: true,
      maerskHeadless: false,
      maerskTimeoutMs: 90000,
      maerskUserDataDir: 'C:\\AgentData',
    })),
    emitAuditEvent: vi.fn(async () => undefined),
    isRateLimited: vi.fn(() => false),
    generateAgentToken: vi.fn(() => 'generated-agent-token'),
    ...overrides,
  }
}

function createEnrollRequest(
  command: { readonly token?: string; readonly body?: Record<string, unknown> } = {},
): Request {
  return new Request('http://localhost/api/agent/enroll', {
    method: 'POST',
    headers: {
      ...(command.token ? { authorization: `Bearer ${command.token}` } : {}),
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.10',
    },
    body: JSON.stringify(
      command.body ?? {
        machineFingerprint: 'fingerprint-1',
        hostname: 'host-1',
        os: 'windows',
        agentVersion: '0.1.0',
      },
    ),
  })
}

describe('agent enroll controllers', () => {
  it('returns 400 for invalid payload', async () => {
    const deps = createDeps()
    const controllers = createAgentEnrollControllers(deps)

    const response = await controllers.enroll({
      request: createEnrollRequest({
        token: 'installer-token-1',
        body: { machineFingerprint: '' },
      }),
    })

    expect(response.status).toBe(400)
  })

  it('returns 429 when rate limit is exceeded', async () => {
    const deps = createDeps({
      isRateLimited: vi.fn(() => true),
    })
    const controllers = createAgentEnrollControllers(deps)

    const response = await controllers.enroll({
      request: createEnrollRequest({ token: 'installer-token-1' }),
    })

    expect(response.status).toBe(429)
  })

  it('returns 401 when installer token is missing', async () => {
    const deps = createDeps()
    const controllers = createAgentEnrollControllers(deps)

    const response = await controllers.enroll({
      request: createEnrollRequest(),
    })

    expect(response.status).toBe(401)
  })

  it('creates a new agent when machine fingerprint is not enrolled', async () => {
    const deps = createDeps()
    const controllers = createAgentEnrollControllers(deps)

    const response = await controllers.enroll({
      request: createEnrollRequest({ token: 'installer-token-1' }),
    })

    const body = AgentEnrollResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.agentToken).toBe('agent-token-1')
    expect(deps.createAgent).toHaveBeenCalledTimes(1)
    expect(deps.updateAgentEnrollmentMetadata).not.toHaveBeenCalled()
  })

  it('updates metadata and returns existing config when agent is already enrolled', async () => {
    const deps = createDeps({
      findAgentByFingerprint: vi.fn(async () => ({
        id: 'agent-1',
        tenantId: TENANT_ID,
        machineFingerprint: 'fingerprint-1',
        hostname: 'old-host',
        os: 'windows',
        agentVersion: '0.0.9',
        agentToken: 'agent-token-existing',
        intervalSec: 30,
        limit: 25,
        supabaseUrl: 'https://supabase.test',
        supabaseAnonKey: 'anon',
        maerskEnabled: true,
        maerskHeadless: false,
        maerskTimeoutMs: 90000,
        maerskUserDataDir: 'C:\\AgentData',
      })),
    })
    const controllers = createAgentEnrollControllers(deps)

    const response = await controllers.enroll({
      request: createEnrollRequest({ token: 'installer-token-1' }),
    })

    const body = AgentEnrollResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.agentToken).toBe('agent-token-existing')
    expect(body.tenantId).toBe(TENANT_ID)
    expect(body.intervalSec).toBe(30)
    expect(body.limit).toBe(25)
    expect(body.providers.maerskEnabled).toBe(true)
    expect(deps.createAgent).not.toHaveBeenCalled()
    expect(deps.updateAgentEnrollmentMetadata).toHaveBeenCalledTimes(1)
  })
})
