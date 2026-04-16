import {
  type ValidatedAgentConfig,
  ValidatedAgentConfigSchema,
} from '@agent/core/contracts/agent-config.contract'
import type { ProviderRunResult } from '@agent/core/contracts/provider.contract'
import type { AgentSyncJob } from '@agent/core/contracts/sync-job.contract'
import { AgentTokenUnauthorizedError } from '@agent/core/errors/agent-token-unauthorized.error'
import type { ProviderRunnerRegistry } from '@agent/providers/common/provider-runner.registry'
import { runSyncCycle } from '@agent/sync/application/run-sync-cycle'
import type { SyncRuntimeState } from '@agent/sync/application/sync-types'
import type {
  SyncBackendClient,
  SyncTargetsResponse,
} from '@agent/sync/infrastructure/sync-backend.client'
import { describe, expect, it } from 'vitest'

function makeConfig(limit = 2): ValidatedAgentConfig {
  return ValidatedAgentConfigSchema.parse({
    BACKEND_URL: 'https://api.example.com',
    SUPABASE_URL: null,
    SUPABASE_ANON_KEY: null,
    AGENT_TOKEN: 'token-123',
    TENANT_ID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    AGENT_ID: 'agent-a',
    INTERVAL_SEC: 30,
    LIMIT: limit,
    MAERSK_ENABLED: true,
    MAERSK_HEADLESS: true,
    MAERSK_TIMEOUT_MS: 120_000,
    MAERSK_USER_DATA_DIR: null,
    AGENT_UPDATE_MANIFEST_CHANNEL: 'stable',
  })
}

function makeState(): SyncRuntimeState {
  return {
    processingState: 'idle',
    leaseHealth: 'unknown',
    activeJobs: 0,
    queueLagSeconds: null,
    lastError: null,
  }
}

function makeJob(provider: AgentSyncJob['provider'] = 'msc'): AgentSyncJob {
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
      finishedAt: '2026-04-15T00:00:00.200Z',
      durationMs: 200,
    },
  }
}

function makeRegistry(providerResult: ProviderRunResult): ProviderRunnerRegistry {
  return {
    selectProviderRunner(provider) {
      return {
        provider,
        async run() {
          return providerResult
        },
      }
    },
  }
}

function makeTargetsResponse(targets: readonly AgentSyncJob[]): SyncTargetsResponse {
  return {
    targets,
    leasedUntil: null,
    queueLagSeconds: 0,
  }
}

describe('runSyncCycle', () => {
  it('propagates typed unauthorized errors to runtime orchestration', async () => {
    const state = makeState()
    const backendClient: SyncBackendClient = {
      async fetchTargets() {
        throw new AgentTokenUnauthorizedError('targets request unauthorized (401)')
      },
      async ingestSnapshot() {
        return {
          kind: 'accepted',
          snapshotId: '22222222-2222-4222-8222-222222222222',
          newObservationsCount: 0,
          newAlertsCount: 0,
        }
      },
    }

    await expect(
      runSyncCycle({
        config: makeConfig(1),
        agentVersion: '1.0.0',
        state,
        reason: 'interval',
        providerRegistry: makeRegistry(
          makeProviderResult({
            status: 'success',
            raw: { ok: true },
          }),
        ),
        backendClient,
      }),
    ).rejects.toBeInstanceOf(AgentTokenUnauthorizedError)
  })

  it('recovers owned leases on startup and processes a successful target', async () => {
    const state = makeState()
    const fetchCalls: Array<{ readonly recoverOwnedLeases: boolean }> = []
    let recoveredCalled = false
    let processedTargets = 0

    const backendClient: SyncBackendClient = {
      async fetchTargets(command) {
        fetchCalls.push({ recoverOwnedLeases: command.recoverOwnedLeases })
        if (fetchCalls.length === 1) {
          return makeTargetsResponse([])
        }
        if (fetchCalls.length === 2) {
          return makeTargetsResponse([makeJob('msc')])
        }
        return makeTargetsResponse([])
      },
      async ingestSnapshot() {
        processedTargets += 1
        return {
          kind: 'accepted',
          snapshotId: '22222222-2222-4222-8222-222222222222',
          newObservationsCount: 1,
          newAlertsCount: 0,
        }
      },
    }

    const activities = await runSyncCycle({
      config: makeConfig(2),
      agentVersion: '1.0.0',
      state,
      reason: 'startup',
      providerRegistry: makeRegistry(makeProviderResult({ status: 'success', raw: { ok: true } })),
      backendClient,
      onRecoveredOwnedLeases() {
        recoveredCalled = true
      },
    })

    expect(recoveredCalled).toBe(true)
    expect(processedTargets).toBe(1)
    expect(activities).toEqual([])
    expect(state.leaseHealth).toBe('healthy')
    expect(fetchCalls.some((call) => call.recoverOwnedLeases)).toBe(true)
  })

  it('marks blocked results as request failures without ingest', async () => {
    const state = makeState()
    let ingestCalled = false

    const backendClient: SyncBackendClient = {
      async fetchTargets() {
        if (state.processingState === 'idle') {
          return makeTargetsResponse([])
        }
        return makeTargetsResponse([makeJob('maersk')])
      },
      async ingestSnapshot() {
        ingestCalled = true
        return {
          kind: 'accepted',
          snapshotId: '22222222-2222-4222-8222-222222222222',
          newObservationsCount: 1,
          newAlertsCount: 0,
        }
      },
    }

    const activities = await runSyncCycle({
      config: makeConfig(1),
      agentVersion: '1.0.0',
      state,
      reason: 'interval',
      providerRegistry: makeRegistry(
        makeProviderResult({
          status: 'blocked',
          errorCode: 'PROVIDER_BLOCKED',
          errorMessage: 'captcha challenge required',
        }),
      ),
      backendClient,
    })

    expect(ingestCalled).toBe(false)
    expect(activities.length).toBe(1)
    expect(activities[0]?.type).toBe('REQUEST_FAILED')
    expect(state.processingState).toBe('backing_off')
  })

  it('emits lease conflict activity when ingest returns lease_conflict', async () => {
    const state = makeState()

    const backendClient: SyncBackendClient = {
      async fetchTargets() {
        if (state.processingState === 'idle') {
          return makeTargetsResponse([])
        }
        return makeTargetsResponse([makeJob('msc')])
      },
      async ingestSnapshot() {
        return {
          kind: 'lease_conflict',
        }
      },
    }

    const activities = await runSyncCycle({
      config: makeConfig(1),
      agentVersion: '1.0.0',
      state,
      reason: 'interval',
      providerRegistry: makeRegistry(makeProviderResult({ status: 'success', raw: { ok: true } })),
      backendClient,
    })

    expect(activities.length).toBe(1)
    expect(activities[0]?.type).toBe('LEASE_CONFLICT')
    expect(state.leaseHealth).toBe('conflict')
  })
})
