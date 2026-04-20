import type { ValidatedAgentConfig } from '@agent/core/contracts/agent-config.contract'
import type { ProviderRunResult } from '@agent/core/contracts/provider.contract'
import type { AgentSyncJob } from '@agent/core/contracts/sync-job.contract'
import {
  PROVIDER_ERROR_CODES,
  unsupportedProviderError,
} from '@agent/providers/common/provider-error'
import type { ProviderRunnerRegistry } from '@agent/providers/common/provider-runner.registry'
import { ackSyncResult } from '@agent/sync/application/ack-sync-result'
import { reportSyncFailure } from '@agent/sync/application/report-sync-failure'
import { selectProviderRunner } from '@agent/sync/application/select-provider-runner'
import {
  resolveFailureMessage,
  shouldIngestProviderResult,
  shouldReportFailure,
} from '@agent/sync/domain/sync-execution-policy'
import { decideSyncRetryPolicy } from '@agent/sync/domain/sync-retry-policy'
import type { SyncBackendClient } from '@agent/sync/infrastructure/sync-backend.client'
import {
  type toBackendSyncAck,
  type toBackendSyncFailure,
  toProviderInput,
} from '@agent/sync/sync-job.mapper'

export type SyncJobExecutionResult =
  | {
      readonly kind: 'success'
      readonly durationMs: number
      readonly snapshotId: string
      readonly backendAck: ReturnType<typeof toBackendSyncAck>
      readonly providerStatus: ProviderRunResult['status']
    }
  | {
      readonly kind: 'lease_conflict'
      readonly durationMs: number
      readonly errorMessage: string
      readonly providerStatus: ProviderRunResult['status']
    }
  | {
      readonly kind: 'failed'
      readonly durationMs: number
      readonly errorMessage: string
      readonly backendFailure: ReturnType<typeof toBackendSyncFailure>
      readonly providerStatus: ProviderRunResult['status']
      readonly snapshotId?: string
    }

function toDurationMs(result: ProviderRunResult): number {
  return result.timing.durationMs
}

function logProviderResult(command: {
  readonly job: AgentSyncJob
  readonly providerResult: ProviderRunResult
}): void {
  const common = {
    syncRequestId: command.job.syncRequestId,
    provider: command.job.provider,
    refType: command.job.refType,
    ref: command.job.ref,
    providerStatus: command.providerResult.status,
    durationMs: command.providerResult.timing.durationMs,
    observedAt: command.providerResult.observedAt,
  }

  if (command.providerResult.status === 'success') {
    console.log('[agent] provider fetch success', common)
    return
  }

  console.error('[agent] provider fetch failed', {
    ...common,
    errorCode: command.providerResult.errorCode,
    errorMessage: command.providerResult.errorMessage,
    parseError: command.providerResult.parseError,
  })
}

function toUnsupportedProviderResult(provider: string): ProviderRunResult {
  const now = new Date().toISOString()
  const classification = unsupportedProviderError(provider)
  return {
    status: classification.status,
    observedAt: now,
    raw: null,
    parseError: null,
    errorCode: PROVIDER_ERROR_CODES.unsupported,
    errorMessage: classification.message,
    diagnostics: {},
    timing: {
      startedAt: now,
      finishedAt: now,
      durationMs: 0,
    },
  }
}

export async function executeSyncJob(command: {
  readonly config: ValidatedAgentConfig
  readonly job: AgentSyncJob
  readonly agentVersion: string
  readonly providerRegistry: ProviderRunnerRegistry
  readonly backendClient: SyncBackendClient
}): Promise<SyncJobExecutionResult> {
  const runner = selectProviderRunner({
    registry: command.providerRegistry,
    provider: command.job.provider,
  })
  const providerInput = toProviderInput({
    job: command.job,
    config: command.config,
    agentVersion: command.agentVersion,
  })
  console.log('[agent] provider fetch request', {
    syncRequestId: providerInput.syncRequestId,
    provider: providerInput.provider,
    refType: providerInput.refType,
    ref: providerInput.ref,
  })

  const providerResult =
    runner === null
      ? toUnsupportedProviderResult(command.job.provider)
      : await runner.run(providerInput)
  logProviderResult({
    job: command.job,
    providerResult,
  })

  const occurredAt = new Date().toISOString()
  const retryDecision = decideSyncRetryPolicy(providerResult)

  if (shouldIngestProviderResult(providerResult)) {
    const ingestResult = await command.backendClient.ingestSnapshot({
      job: command.job,
      providerResult,
      agentVersion: command.agentVersion,
    })

    if (ingestResult.kind === 'lease_conflict') {
      return {
        kind: 'lease_conflict',
        durationMs: toDurationMs(providerResult),
        errorMessage: `Lease conflict for ${command.job.syncRequestId}`,
        providerStatus: providerResult.status,
      }
    }

    if (ingestResult.kind === 'failed') {
      const backendFailure = reportSyncFailure({
        job: command.job,
        errorMessage: ingestResult.errorMessage,
        occurredAt,
        snapshotId: ingestResult.snapshotId ?? null,
      })

      return {
        kind: 'failed',
        durationMs: toDurationMs(providerResult),
        errorMessage: ingestResult.errorMessage,
        backendFailure,
        providerStatus: providerResult.status,
        ...(ingestResult.snapshotId === undefined ? {} : { snapshotId: ingestResult.snapshotId }),
      }
    }

    if (providerResult.status === 'success') {
      const backendAck = ackSyncResult({
        job: command.job,
        snapshotId: ingestResult.snapshotId,
        occurredAt,
        newObservationsCount: ingestResult.newObservationsCount,
        newAlertsCount: ingestResult.newAlertsCount,
      })

      return {
        kind: 'success',
        durationMs: toDurationMs(providerResult),
        snapshotId: ingestResult.snapshotId,
        backendAck,
        providerStatus: providerResult.status,
      }
    }

    const backendFailure = reportSyncFailure({
      job: command.job,
      errorMessage: resolveFailureMessage(providerResult),
      occurredAt,
      snapshotId: ingestResult.snapshotId,
    })

    return {
      kind: 'failed',
      durationMs: toDurationMs(providerResult),
      errorMessage: backendFailure.error,
      backendFailure,
      providerStatus: providerResult.status,
      snapshotId: ingestResult.snapshotId,
    }
  }

  console.warn('[agent] provider result skipped snapshot ingest', {
    syncRequestId: command.job.syncRequestId,
    provider: command.job.provider,
    ref: command.job.ref,
    providerStatus: providerResult.status,
    retryDecision: retryDecision.reason,
  })

  if (shouldReportFailure(providerResult)) {
    const backendFailure = reportSyncFailure({
      job: command.job,
      errorMessage: resolveFailureMessage(providerResult),
      occurredAt,
      snapshotId: null,
    })

    return {
      kind: 'failed',
      durationMs: toDurationMs(providerResult),
      errorMessage: backendFailure.error,
      backendFailure,
      providerStatus: providerResult.status,
    }
  }

  const backendFailure = reportSyncFailure({
    job: command.job,
    errorMessage: `invalid sync outcome (retry=${retryDecision.reason})`,
    occurredAt,
    snapshotId: null,
  })

  return {
    kind: 'failed',
    durationMs: toDurationMs(providerResult),
    errorMessage: backendFailure.error,
    backendFailure,
    providerStatus: providerResult.status,
  }
}
