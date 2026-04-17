import { ValidatedAgentConfigSchema } from '@agent/core/contracts/agent-config.contract'
import { AgentTokenUnauthorizedError } from '@agent/core/errors/agent-token-unauthorized.error'
import { createSyncBackendClient } from '@agent/sync/infrastructure/sync-backend.client'
import { describe, expect, it, vi } from 'vitest'

function createConfig() {
  return ValidatedAgentConfigSchema.parse({
    BACKEND_URL: 'https://backend.test.local',
    SUPABASE_URL: null,
    SUPABASE_ANON_KEY: null,
    AGENT_TOKEN: 'agent-token-test',
    TENANT_ID: '00000000-0000-4000-8000-000000000001',
    AGENT_ID: '11111111-1111-4111-8111-111111111111',
    INTERVAL_SEC: 60,
    LIMIT: 10,
    MAERSK_ENABLED: false,
    MAERSK_HEADLESS: true,
    MAERSK_TIMEOUT_MS: 120000,
    MAERSK_USER_DATA_DIR: null,
    AGENT_UPDATE_MANIFEST_CHANNEL: 'stable',
  })
}

describe('sync backend client unauthorized errors', () => {
  it('throws typed unauthorized error on targets 401 response', async () => {
    const fetchImpl = vi.fn(async () => new Response('Unauthorized', { status: 401 }))
    const client = createSyncBackendClient({
      config: createConfig(),
      fetchImpl,
    })

    await expect(
      client.fetchTargets({
        limit: 1,
        recoverOwnedLeases: false,
      }),
    ).rejects.toBeInstanceOf(AgentTokenUnauthorizedError)
  })

  it('throws typed unauthorized error on ingest 401 response', async () => {
    const fetchImpl = vi.fn(async () => new Response('Unauthorized', { status: 401 }))
    const client = createSyncBackendClient({
      config: createConfig(),
      fetchImpl,
    })

    await expect(
      client.ingestSnapshot({
        job: {
          syncRequestId: 'a6bf97b4-f0ca-4e70-b3fb-6afe2153f82f',
          provider: 'msc',
          refType: 'container',
          ref: 'MSCU1234567',
        },
        providerResult: {
          status: 'success',
          observedAt: '2026-04-16T12:00:00.000Z',
          raw: { provider: 'msc' },
          parseError: null,
          errorCode: null,
          errorMessage: null,
          diagnostics: {},
          timing: {
            startedAt: '2026-04-16T11:59:58.000Z',
            finishedAt: '2026-04-16T12:00:00.000Z',
            durationMs: 2000,
          },
        },
        agentVersion: '1.0.0',
      }),
    ).rejects.toBeInstanceOf(AgentTokenUnauthorizedError)
  })
})
