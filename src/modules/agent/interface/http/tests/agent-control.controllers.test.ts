import { AgentInfraConfigResponseSchema } from '@tools/agent/control-core/contracts'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockedServerEnv } = vi.hoisted(() => ({
  mockedServerEnv: (() => {
    const value: {
      AGENT_ENROLL_SUPABASE_URL: string
      AGENT_ENROLL_SUPABASE_ANON_KEY: string | null
      SUPABASE_URL: string
    } = {
      AGENT_ENROLL_SUPABASE_URL: 'https://enroll.supabase.test',
      AGENT_ENROLL_SUPABASE_ANON_KEY: 'fresh-anon-key',
      SUPABASE_URL: 'https://legacy.supabase.test',
    }

    return value
  })(),
}))

vi.mock('~/shared/config/server-env', () => ({
  serverEnv: mockedServerEnv,
}))

import type { AgentMonitoringUseCases } from '~/modules/agent/application/agent-monitoring.usecases'
import { createAgentControlControllers } from '~/modules/agent/interface/http/agent-control.controllers'

type AgentControlDeps = Pick<
  AgentMonitoringUseCases,
  | 'authenticateAgentToken'
  | 'getRemoteControlState'
  | 'getInfraConfig'
  | 'acknowledgeRemoteControlCommand'
>

function createDeps(overrides: Partial<AgentControlDeps> = {}): AgentControlDeps {
  return {
    authenticateAgentToken: vi.fn(async () => ({
      tenantId: '11111111-1111-4111-8111-111111111111',
      agentId: '22222222-2222-4222-8222-222222222222',
      hostname: 'agent-host',
      intervalSec: 60,
      capabilities: ['msc', 'cmacgm', 'pil', 'one'],
    })),
    getRemoteControlState: vi.fn(async () => null),
    getInfraConfig: vi.fn(async () => ({
      supabaseUrl: 'https://stale-record.supabase.test',
      supabaseAnonKey: 'stale-record-anon-key',
    })),
    acknowledgeRemoteControlCommand: vi.fn(async () => true),
    ...overrides,
  }
}

function createAuthedRequest(): Request {
  return new Request('http://localhost/api/agent/infra-config', {
    method: 'GET',
    headers: {
      authorization: 'Bearer agent-token',
    },
  })
}

describe('agent control controllers', () => {
  beforeEach(() => {
    mockedServerEnv.AGENT_ENROLL_SUPABASE_URL = 'https://enroll.supabase.test'
    mockedServerEnv.AGENT_ENROLL_SUPABASE_ANON_KEY = 'fresh-anon-key'
    mockedServerEnv.SUPABASE_URL = 'https://legacy.supabase.test'
  })

  it('prefers backend enroll infra config over stale persisted agent infra', async () => {
    const deps = createDeps()
    const controllers = createAgentControlControllers({ agentMonitoringUseCases: deps })

    const response = await controllers.getInfraConfig({ request: createAuthedRequest() })
    const body = AgentInfraConfigResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body).toEqual({
      supabaseUrl: 'https://enroll.supabase.test',
      supabaseAnonKey: 'fresh-anon-key',
    })
  })

  it('falls back to persisted infra config when backend env has no anon key override', async () => {
    mockedServerEnv.AGENT_ENROLL_SUPABASE_ANON_KEY = null

    const deps = createDeps({
      getInfraConfig: vi.fn(async () => ({
        supabaseUrl: 'https://persisted.supabase.test',
        supabaseAnonKey: 'persisted-anon-key',
      })),
    })
    const controllers = createAgentControlControllers({ agentMonitoringUseCases: deps })

    const response = await controllers.getInfraConfig({ request: createAuthedRequest() })
    const body = AgentInfraConfigResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body).toEqual({
      supabaseUrl: 'https://persisted.supabase.test',
      supabaseAnonKey: 'persisted-anon-key',
    })
  })
})
