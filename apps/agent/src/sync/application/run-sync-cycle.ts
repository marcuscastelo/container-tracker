import type { AgentRunReason } from '@agent/agent.scheduler'
import type { ValidatedAgentConfig } from '@agent/core/contracts/agent-config.contract'
import type { ProviderRunnerRegistry } from '@agent/providers/common/provider-runner.registry'
import { executeSyncJob } from '@agent/sync/application/execute-sync-job'
import { pollWork } from '@agent/sync/application/poll-work'
import type { SyncCycleActivity, SyncRuntimeState } from '@agent/sync/application/sync-types'
import type { SyncBackendClient } from '@agent/sync/infrastructure/sync-backend.client'

export async function runSyncCycle(command: {
  readonly config: ValidatedAgentConfig
  readonly agentVersion: string
  readonly state: SyncRuntimeState
  readonly reason: AgentRunReason
  readonly providerRegistry: ProviderRunnerRegistry
  readonly backendClient: SyncBackendClient
  readonly leaseBatchSize?: number
  readonly onRecoveredOwnedLeases?: () => void
  readonly onNoTargets?: () => void
  readonly onCycleProcessed?: (processed: number) => void
}): Promise<readonly SyncCycleActivity[]> {
  const leaseBatchSize = command.leaseBatchSize ?? 1
  let processed = 0
  const activities: SyncCycleActivity[] = []
  command.state.processingState = 'leasing'
  command.state.activeJobs = 0

  while (processed < command.config.LIMIT) {
    const pollResult = await pollWork({
      backendClient: command.backendClient,
      reason: command.reason,
      processed,
      limit: command.config.LIMIT,
      leaseBatchSize,
      onRecoveredOwnedLeases: command.onRecoveredOwnedLeases,
    })

    command.state.queueLagSeconds = pollResult.targetsResponse.queueLagSeconds
    const targets = pollResult.targetsResponse.targets

    if (targets.length === 0) {
      if (processed === 0) {
        command.onNoTargets?.()
      }
      command.state.processingState = 'idle'
      command.state.activeJobs = 0
      break
    }

    for (const target of targets) {
      command.state.processingState = 'processing'
      command.state.activeJobs = 1
      const result = await executeSyncJob({
        config: command.config,
        job: target,
        agentVersion: command.agentVersion,
        providerRegistry: command.providerRegistry,
        backendClient: command.backendClient,
      })
      command.state.activeJobs = 0
      processed += 1

      if (result.kind === 'success') {
        command.state.lastError = null
        command.state.leaseHealth = 'healthy'
        continue
      }

      if (result.kind === 'lease_conflict') {
        command.state.leaseHealth = 'conflict'
        command.state.lastError = result.errorMessage
        activities.push({
          type: 'LEASE_CONFLICT',
          message: result.errorMessage,
          severity: 'warning',
          metadata: {
            syncRequestId: target.syncRequestId,
            provider: target.provider,
            ref: target.ref,
            durationMs: result.durationMs,
            providerStatus: result.providerStatus,
          },
        })
        continue
      }

      command.state.processingState = 'backing_off'
      command.state.lastError = result.errorMessage
      activities.push({
        type: 'REQUEST_FAILED',
        message: result.backendFailure.error,
        severity: 'danger',
        metadata: {
          ...result.backendFailure,
          durationMs: result.durationMs,
          providerStatus: result.providerStatus,
        },
      })
    }
  }

  if (processed > 0) {
    command.onCycleProcessed?.(processed)
  }

  if (command.state.processingState !== 'backing_off') {
    command.state.processingState = 'idle'
  }

  return activities
}
