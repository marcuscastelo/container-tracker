import {
  type ValidatedAgentConfig,
  ValidatedAgentConfigSchema,
} from '@agent/core/contracts/agent-config.contract'
import type { ProviderRunResult } from '@agent/core/contracts/provider.contract'
import type { AgentSyncJob } from '@agent/core/contracts/sync-job.contract'
import type { ProviderRunnerRegistry } from '@agent/providers/common/provider-runner.registry'
import { executeSyncJob } from '@agent/sync/application/execute-sync-job'
import type { SyncBackendClient } from '@agent/sync/infrastructure/sync-backend.client'
import { describe, expect, it } from 'vitest'

function makeConfig(): ValidatedAgentConfig {
  return ValidatedAgentConfigSchema.parse({
    BACKEND_URL: 'https://api.example.com',
    SUPABASE_URL: null,
    SUPABASE_ANON_KEY: null,
    AGENT_TOKEN: 'token-123',
    TENANT_ID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    AGENT_ID: 'agent-a',
    INTERVAL_SEC: 30,
    LIMIT: 10,
    MAERSK_ENABLED: true,
    MAERSK_HEADLESS: true,
    MAERSK_TIMEOUT_MS: 120_000,
    MAERSK_USER_DATA_DIR: null,
    AGENT_UPDATE_MANIFEST_CHANNEL: 'stable',
  })
}

function makeJob(provider: AgentSyncJob['provider']): AgentSyncJob {
  return {
    syncRequestId: '11111111-1111-4111-8111-111111111111',
    provider,
    refType: 'container',
    ref: 'MSCU1234567',
  }
}

function makeProviderResult(command: {
  readonly status: ProviderRunResult['status']
  readonly raw?: unknown
  readonly parseError?: string | null
  readonly errorCode?: string | null
  readonly errorMessage?: string | null
}): ProviderRunResult {
  return {
    status: command.status,
    observedAt: '2026-04-15T00:00:00.000Z',
    raw: command.raw ?? null,
    parseError: command.parseError ?? null,
    errorCode:
      command.errorCode ?? (command.status === 'success' ? null : 'PROVIDER_EXECUTION_ERROR'),
    errorMessage:
      command.errorMessage ?? (command.status === 'success' ? null : 'provider execution failed'),
    diagnostics: {},
    timing: {
      startedAt: '2026-04-15T00:00:00.000Z',
      finishedAt: '2026-04-15T00:00:00.100Z',
      durationMs: 100,
    },
  }
}

function makeRegistry(result: ProviderRunResult): ProviderRunnerRegistry {
  return {
    selectProviderRunner() {
      return {
        provider: 'msc',
        async run() {
          return result
        },
      }
    },
  }
}

function makeBackendClient(overrides?: {
  readonly ingestSnapshot?: SyncBackendClient['ingestSnapshot']
}): SyncBackendClient {
  return {
    async fetchTargets() {
      throw new Error('not used in executeSyncJob tests')
    },
    async ingestSnapshot(command) {
      if (overrides?.ingestSnapshot) {
        return overrides.ingestSnapshot(command)
      }

      return {
        kind: 'accepted' as const,
        snapshotId: '22222222-2222-4222-8222-222222222222',
        newObservationsCount: 2,
        newAlertsCount: 1,
      }
    },
  }
}

describe('executeSyncJob', () => {
  it('handles success path with ingest and ack mapping', async () => {
    const result = await executeSyncJob({
      config: makeConfig(),
      job: makeJob('msc'),
      agentVersion: '1.0.0',
      providerRegistry: makeRegistry(
        makeProviderResult({
          status: 'success',
          raw: { ok: true },
        }),
      ),
      backendClient: makeBackendClient(),
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.backendAck.status).toBe('DONE')
    }
  })

  it('does not ingest retryable failures', async () => {
    let ingestCalled = false
    const result = await executeSyncJob({
      config: makeConfig(),
      job: makeJob('msc'),
      agentVersion: '1.0.0',
      providerRegistry: makeRegistry(
        makeProviderResult({
          status: 'retryable_failure',
          errorCode: 'PROVIDER_TRANSPORT_ERROR',
          errorMessage: 'timeout',
        }),
      ),
      backendClient: makeBackendClient({
        async ingestSnapshot() {
          ingestCalled = true
          return {
            kind: 'accepted',
            snapshotId: '22222222-2222-4222-8222-222222222222',
            newObservationsCount: null,
            newAlertsCount: null,
          }
        },
      }),
    })

    expect(result.kind).toBe('failed')
    expect(ingestCalled).toBe(false)
  })

  it('ingests terminal failure with raw payload to preserve audit trail', async () => {
    let ingestCalled = false

    const result = await executeSyncJob({
      config: makeConfig(),
      job: makeJob('msc'),
      agentVersion: '1.0.0',
      providerRegistry: makeRegistry(
        makeProviderResult({
          status: 'terminal_failure',
          raw: { malformed: true },
          parseError: 'schema mismatch',
          errorCode: 'PROVIDER_PARSE_ERROR',
          errorMessage: 'schema mismatch',
        }),
      ),
      backendClient: makeBackendClient({
        async ingestSnapshot() {
          ingestCalled = true
          return {
            kind: 'failed',
            errorMessage: 'schema mismatch',
            snapshotId: '33333333-3333-4333-8333-333333333333',
          }
        },
      }),
    })

    expect(ingestCalled).toBe(true)
    expect(result.kind).toBe('failed')
    if (result.kind === 'failed') {
      expect(result.snapshotId).toBe('33333333-3333-4333-8333-333333333333')
    }
  })

  it('treats blocked provider result as failure without ingest', async () => {
    let ingestCalled = false
    const result = await executeSyncJob({
      config: makeConfig(),
      job: makeJob('maersk'),
      agentVersion: '1.0.0',
      providerRegistry: makeRegistry(
        makeProviderResult({
          status: 'blocked',
          errorCode: 'PROVIDER_BLOCKED',
          errorMessage: 'captcha challenge required',
        }),
      ),
      backendClient: makeBackendClient({
        async ingestSnapshot() {
          ingestCalled = true
          return {
            kind: 'accepted',
            snapshotId: '22222222-2222-4222-8222-222222222222',
            newObservationsCount: null,
            newAlertsCount: null,
          }
        },
      }),
    })

    expect(result.kind).toBe('failed')
    expect(ingestCalled).toBe(false)
  })

  it('propagates lease conflicts from ingest response', async () => {
    const result = await executeSyncJob({
      config: makeConfig(),
      job: makeJob('msc'),
      agentVersion: '1.0.0',
      providerRegistry: makeRegistry(
        makeProviderResult({
          status: 'success',
          raw: { ok: true },
        }),
      ),
      backendClient: makeBackendClient({
        async ingestSnapshot() {
          return { kind: 'lease_conflict' }
        },
      }),
    })

    expect(result.kind).toBe('lease_conflict')
  })

  it('handles provider unsupported when registry has no runner', async () => {
    const result = await executeSyncJob({
      config: makeConfig(),
      job: makeJob('one'),
      agentVersion: '1.0.0',
      providerRegistry: {
        selectProviderRunner() {
          return null
        },
      },
      backendClient: makeBackendClient(),
    })

    expect(result.kind).toBe('failed')
    if (result.kind === 'failed') {
      expect(result.backendFailure.error).toContain('unsupported provider')
    }
  })
})
