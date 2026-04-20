import type { ValidatedAgentConfig } from '@agent/core/contracts/agent-config.contract'
import type { ProviderInput } from '@agent/core/contracts/provider.contract'
import {
  type AgentSyncJob,
  AgentSyncJobSchema,
  type BackendSyncAckDTO,
  BackendSyncAckDTOSchema,
  type BackendSyncFailureDTO,
  BackendSyncFailureDTOSchema,
  type BackendSyncJobDTO,
} from '@agent/core/contracts/sync-job.contract'

export function toAgentSyncJob(dto: BackendSyncJobDTO): AgentSyncJob {
  return AgentSyncJobSchema.parse({
    syncRequestId: dto.sync_request_id,
    provider: dto.provider,
    refType: dto.ref_type,
    ref: dto.ref,
  })
}

export function toProviderInput(command: {
  readonly job: AgentSyncJob
  readonly config: ValidatedAgentConfig
  readonly agentVersion: string
}): ProviderInput {
  return {
    syncRequestId: command.job.syncRequestId,
    provider: command.job.provider,
    refType: command.job.refType,
    ref: command.job.ref,
    hints: {
      timeoutMs: command.config.MAERSK_TIMEOUT_MS,
      maerskEnabled: command.config.MAERSK_ENABLED,
      maerskHeadless: command.config.MAERSK_HEADLESS,
      maerskTimeoutMs: command.config.MAERSK_TIMEOUT_MS,
      maerskUserDataDir: command.config.MAERSK_USER_DATA_DIR,
    },
    correlation: {
      tenantId: command.config.TENANT_ID,
      agentId: command.config.AGENT_ID,
      agentVersion: command.agentVersion,
    },
  }
}

export function toBackendSyncAck(command: {
  readonly job: AgentSyncJob
  readonly snapshotId: string
  readonly occurredAt: string
  readonly newObservationsCount: number | null
  readonly newAlertsCount: number | null
}): BackendSyncAckDTO {
  return BackendSyncAckDTOSchema.parse({
    sync_request_id: command.job.syncRequestId,
    provider: command.job.provider,
    ref_type: command.job.refType,
    ref: command.job.ref,
    status: 'DONE',
    snapshot_id: command.snapshotId,
    new_observations_count: command.newObservationsCount,
    new_alerts_count: command.newAlertsCount,
    occurred_at: command.occurredAt,
  })
}

export function toBackendSyncFailure(command: {
  readonly job: AgentSyncJob
  readonly errorMessage: string
  readonly occurredAt: string
  readonly snapshotId: string | null
}): BackendSyncFailureDTO {
  return BackendSyncFailureDTOSchema.parse({
    sync_request_id: command.job.syncRequestId,
    provider: command.job.provider,
    ref_type: command.job.refType,
    ref: command.job.ref,
    status: 'FAILED',
    error: command.errorMessage,
    snapshot_id: command.snapshotId,
    occurred_at: command.occurredAt,
  })
}
