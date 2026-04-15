import type { ValidatedAgentConfig } from '@agent/core/contracts/agent-config.contract'
import type { ProviderRunResult } from '@agent/core/contracts/provider.contract'
import {
  type AgentSyncJob,
  BackendSyncTargetsResponseDTOSchema,
  IngestAcceptedResponseSchema,
  IngestFailedResponseSchema,
} from '@agent/core/contracts/sync-job.contract'
import { toAgentSyncJob } from '@agent/sync/sync-job.mapper'

export type SyncTargetsResponse = {
  readonly targets: readonly AgentSyncJob[]
  readonly leasedUntil: string | null
  readonly queueLagSeconds: number | null
}

export type IngestSnapshotResult =
  | {
      readonly kind: 'accepted'
      readonly snapshotId: string
      readonly newObservationsCount: number | null
      readonly newAlertsCount: number | null
    }
  | {
      readonly kind: 'failed'
      readonly errorMessage: string
      readonly snapshotId?: string
    }
  | {
      readonly kind: 'lease_conflict'
    }

export type SyncBackendClient = {
  fetchTargets(command: {
    readonly limit: number
    readonly recoverOwnedLeases: boolean
  }): Promise<SyncTargetsResponse>
  ingestSnapshot(command: {
    readonly job: AgentSyncJob
    readonly providerResult: ProviderRunResult
    readonly agentVersion: string
  }): Promise<IngestSnapshotResult>
}

function buildHeaders(config: ValidatedAgentConfig, contentType: boolean): Headers {
  const headers = new Headers()
  headers.set('x-agent-id', config.AGENT_ID)
  headers.set('user-agent', `container-tracker-agent/${config.AGENT_ID}`)
  headers.set('authorization', `Bearer ${config.AGENT_TOKEN}`)
  if (contentType) {
    headers.set('content-type', 'application/json')
  }
  return headers
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function createSyncBackendClient(command: {
  readonly config: ValidatedAgentConfig
  readonly fetchImpl?: typeof fetch
}): SyncBackendClient {
  const fetchImpl = command.fetchImpl ?? fetch

  return {
    async fetchTargets(fetchCommand): Promise<SyncTargetsResponse> {
      const url = new URL('/api/agent/targets', command.config.BACKEND_URL)
      url.searchParams.set('tenant_id', command.config.TENANT_ID)
      url.searchParams.set('limit', String(fetchCommand.limit))
      if (fetchCommand.recoverOwnedLeases) {
        url.searchParams.set('recover_owned_leases', 'true')
      }

      const response = await fetchImpl(url, {
        method: 'GET',
        headers: buildHeaders(command.config, false),
      })

      if (!response.ok) {
        const details = await response.text().catch(() => '')
        throw new Error(`targets request failed (${response.status}): ${details}`)
      }

      const payload: unknown = await response.json().catch(() => ({}))
      const parsed = BackendSyncTargetsResponseDTOSchema.safeParse(payload)
      if (!parsed.success) {
        throw new Error(`invalid targets response: ${parsed.error.message}`)
      }

      return {
        targets: parsed.data.targets.map((target) => toAgentSyncJob(target)),
        leasedUntil: parsed.data.leased_until,
        queueLagSeconds: parsed.data.queue_lag_seconds,
      }
    },

    async ingestSnapshot(ingestCommand): Promise<IngestSnapshotResult> {
      const response = await fetchImpl(
        `${command.config.BACKEND_URL}/api/tracking/snapshots/ingest`,
        {
          method: 'POST',
          headers: buildHeaders(command.config, true),
          body: JSON.stringify({
            tenant_id: command.config.TENANT_ID,
            provider: ingestCommand.job.provider,
            ref: {
              type: 'container',
              value: ingestCommand.job.ref,
            },
            observed_at: ingestCommand.providerResult.observedAt,
            raw: ingestCommand.providerResult.raw,
            parse_error: ingestCommand.providerResult.parseError,
            meta: {
              agent_version: ingestCommand.agentVersion,
              host: command.config.AGENT_ID,
              provider_error_code: ingestCommand.providerResult.errorCode,
              provider_error_message: ingestCommand.providerResult.errorMessage,
              provider_diagnostics: ingestCommand.providerResult.diagnostics,
              job_duration_ms: ingestCommand.providerResult.timing.durationMs,
            },
            sync_request_id: ingestCommand.job.syncRequestId,
          }),
        },
      )

      if (response.status === 409) {
        return { kind: 'lease_conflict' }
      }

      if (response.status === 422) {
        const payload: unknown = await response.json().catch(() => ({}))
        const parsed = IngestFailedResponseSchema.safeParse(payload)
        if (!parsed.success) {
          throw new Error(`invalid ingest failure response: ${parsed.error.message}`)
        }

        return {
          kind: 'failed',
          errorMessage: parsed.data.error,
          ...(parsed.data.snapshot_id === undefined ? {} : { snapshotId: parsed.data.snapshot_id }),
        }
      }

      if (!response.ok) {
        const details = await response.text().catch(() => '')
        throw new Error(`ingest failed (${response.status}): ${details}`)
      }

      const payload: unknown = await response.json().catch(() => ({}))
      const parsed = IngestAcceptedResponseSchema.safeParse(payload)
      if (!parsed.success) {
        throw new Error(
          `invalid ingest response: ${parsed.error.message}; payload=${safeStringify(payload)}`,
        )
      }

      return {
        kind: 'accepted',
        snapshotId: parsed.data.snapshot_id,
        newObservationsCount: parsed.data.new_observations_count ?? null,
        newAlertsCount: parsed.data.new_alerts_count ?? null,
      }
    },
  }
}
