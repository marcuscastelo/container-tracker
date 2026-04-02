import type { Provider } from '~/modules/tracking/domain/model/provider'
import {
  GetAgentTargetsQuerySchema,
  GetAgentTargetsResponseSchema,
  IngestLeaseConflictResponseSchema,
  IngestSnapshotAcceptedResponseSchema,
  IngestSnapshotBodySchema,
  IngestSnapshotFailedResponseSchema,
  type SyncRequestRow,
} from '~/modules/tracking/interface/http/agent-sync.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'

type AgentAuthIdentity = {
  readonly tenantId: string
  readonly agentId: string
  readonly capabilities: readonly string[]
}

type ContainerLookupRecord = {
  readonly id: string
  readonly containerNumber: string
  readonly carrierCode: string
}

type AgentRuntimeStateUpdate = {
  readonly agentId: string
  readonly tenantId: string
  readonly lastSeenAt?: string
  readonly processingState?: 'idle' | 'leasing' | 'processing' | 'backing_off' | 'unknown'
  readonly leaseHealth?: 'healthy' | 'stale' | 'conflict' | 'unknown'
  readonly activeJobs?: number
  readonly queueLagSeconds?: number | null
  readonly lastError?: string | null
}

type AgentActivityEvent = {
  readonly agentId: string
  readonly tenantId: string
  readonly type:
    | 'ENROLLED'
    | 'HEARTBEAT'
    | 'LEASED_TARGET'
    | 'SNAPSHOT_INGESTED'
    | 'REQUEST_FAILED'
    | 'REALTIME_SUBSCRIBED'
    | 'REALTIME_CHANNEL_ERROR'
    | 'LEASE_CONFLICT'
  readonly message: string
  readonly severity: 'info' | 'warning' | 'danger' | 'success'
  readonly metadata: Record<string, unknown>
  readonly occurredAt?: string
}

export type AgentSyncControllersDeps = {
  readonly leaseSyncRequests: (command: {
    readonly tenantId: string
    readonly agentId: string
    readonly limit: number
    readonly leaseMinutes: number
    readonly includeOwnedActiveLeases: boolean
    readonly processableProviders: readonly Provider[]
  }) => Promise<readonly SyncRequestRow[]>
  readonly findLeasedSyncRequest: (command: {
    readonly tenantId: string
    readonly syncRequestId: string
    readonly agentId: string
  }) => Promise<SyncRequestRow | null>
  readonly markSyncRequestDone: (command: {
    readonly tenantId: string
    readonly syncRequestId: string
    readonly agentId: string
  }) => Promise<boolean>
  readonly markSyncRequestFailed: (command: {
    readonly tenantId: string
    readonly syncRequestId: string
    readonly agentId: string
    readonly errorMessage: string
  }) => Promise<boolean>
  readonly findContainersByNumber: (command: {
    readonly containerNumbers: readonly string[]
  }) => Promise<readonly ContainerLookupRecord[]>
  readonly saveAndProcess: (command: {
    readonly containerId: string
    readonly containerNumber: string
    readonly provider: Provider
    readonly payload: unknown
    readonly parseError?: string | null
    readonly fetchedAt: string
  }) => Promise<{ readonly snapshotId: string }>
  readonly authenticateAgentToken: (command: {
    readonly token: string
  }) => Promise<AgentAuthIdentity | null>
  readonly getTenantQueueLagSeconds: (command: {
    readonly tenantId: string
  }) => Promise<number | null>
  readonly updateAgentRuntimeState: (command: AgentRuntimeStateUpdate) => Promise<void>
  readonly recordAgentActivity: (
    command: AgentActivityEvent | readonly AgentActivityEvent[],
  ) => Promise<void>
  readonly leaseMinutes: number
}

function getBearerToken(authorization: string | null): string | null {
  if (!authorization) return null
  const [scheme, token] = authorization.trim().split(/\s+/u)
  if (scheme !== 'Bearer' || !token) return null
  return token
}

function getAgentId(request: Request): string {
  const fromHeader = request.headers.get('x-agent-id')?.trim()
  if (fromHeader && fromHeader.length > 0) {
    return fromHeader
  }

  const userAgent = request.headers.get('user-agent')?.trim()
  if (userAgent && userAgent.length > 0) {
    return userAgent
  }

  return 'unknown-agent'
}

function normalizeContainerNumber(value: string): string {
  return value.toUpperCase().trim()
}

function normalizeCarrierCode(value: string): string {
  return value.toLowerCase().trim()
}

const PROCESSABLE_PROVIDER_ORDER: readonly Provider[] = ['maersk', 'msc', 'cmacgm', 'pil']

function toProcessableProviders(capabilities: readonly string[]): readonly Provider[] {
  const capabilitySet = new Set(capabilities)
  return PROCESSABLE_PROVIDER_ORDER.filter((provider) => capabilitySet.has(provider))
}

async function ensureAgentAuth(
  request: Request,
  deps: AgentSyncControllersDeps,
): Promise<AgentAuthIdentity | Response> {
  const providedToken = getBearerToken(request.headers.get('authorization'))
  if (!providedToken) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const auth = await deps.authenticateAgentToken({ token: providedToken })
  if (!auth) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  return auth
}

function hasSameTarget(leased: SyncRequestRow, provider: Provider, refValue: string): boolean {
  return (
    leased.provider === provider &&
    leased.ref_type === 'container' &&
    normalizeContainerNumber(leased.ref_value) === normalizeContainerNumber(refValue)
  )
}

function buildResolveErrorMessage(
  provider: Provider,
  refValue: string,
  candidates: number,
): string {
  if (candidates === 0) {
    return `No container found for ${provider}:${normalizeContainerNumber(refValue)}`
  }
  return `Ambiguous container for ${provider}:${normalizeContainerNumber(refValue)}`
}

function extractDurationMs(meta: Readonly<Record<string, unknown>>): number | null {
  const fromSnakeCase = meta.job_duration_ms
  if (typeof fromSnakeCase === 'number' && Number.isFinite(fromSnakeCase)) {
    return Math.max(0, Math.round(fromSnakeCase))
  }

  const fromCamelCase = meta.jobDurationMs
  if (typeof fromCamelCase === 'number' && Number.isFinite(fromCamelCase)) {
    return Math.max(0, Math.round(fromCamelCase))
  }

  return null
}

async function runTelemetrySafely(action: () => Promise<void>): Promise<void> {
  try {
    await action()
  } catch (error) {
    console.error('[agent-sync] failed to persist observability data', error)
  }
}

export function createAgentSyncControllers(deps: AgentSyncControllersDeps) {
  async function getTargets({ request }: { request: Request }): Promise<Response> {
    try {
      const authResult = await ensureAgentAuth(request, deps)
      if (authResult instanceof Response) return authResult

      const url = new URL(request.url)
      const parsedQuery = GetAgentTargetsQuerySchema.safeParse({
        tenant_id: url.searchParams.get('tenant_id'),
        limit: url.searchParams.get('limit') ?? undefined,
        recover_owned_leases: url.searchParams.get('recover_owned_leases') ?? undefined,
      })

      if (!parsedQuery.success) {
        return jsonResponse({ error: `Invalid query: ${parsedQuery.error.message}` }, 400)
      }

      if (parsedQuery.data.tenant_id !== authResult.tenantId) {
        return jsonResponse({ error: 'Forbidden' }, 403)
      }

      const runtimeAgentId = getAgentId(request)
      const processableProviders = toProcessableProviders(authResult.capabilities)
      const leased = await deps.leaseSyncRequests({
        tenantId: parsedQuery.data.tenant_id,
        agentId: authResult.agentId,
        limit: parsedQuery.data.limit,
        leaseMinutes: deps.leaseMinutes,
        includeOwnedActiveLeases: parsedQuery.data.recover_owned_leases,
        processableProviders,
      })

      const queueLagSeconds = await deps.getTenantQueueLagSeconds({
        tenantId: parsedQuery.data.tenant_id,
      })
      const nowIso = new Date().toISOString()

      await runTelemetrySafely(async () => {
        await deps.updateAgentRuntimeState({
          agentId: authResult.agentId,
          tenantId: authResult.tenantId,
          lastSeenAt: nowIso,
          processingState: leased.length > 0 ? 'processing' : 'idle',
          leaseHealth: 'healthy',
          activeJobs: leased.length,
          queueLagSeconds,
          lastError: null,
        })
      })

      if (leased.length > 0) {
        await runTelemetrySafely(async () => {
          await deps.recordAgentActivity(
            leased.map((item) => ({
              agentId: authResult.agentId,
              tenantId: authResult.tenantId,
              type: 'LEASED_TARGET',
              message: `Leased ${item.provider}:${item.ref_value}`,
              severity: 'info',
              metadata: {
                syncRequestId: item.id,
                provider: item.provider,
                ref: item.ref_value,
                runtimeAgentId,
              },
              occurredAt: nowIso,
            })),
          )
        })
      }

      const response = {
        targets: leased.map((item) => ({
          sync_request_id: item.id,
          provider: item.provider,
          ref_type: item.ref_type,
          ref: item.ref_value,
        })),
        leased_until: leased[0]?.leased_until ?? null,
        queue_lag_seconds: queueLagSeconds,
      }

      return jsonResponse(response, 200, GetAgentTargetsResponseSchema)
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function ingestSnapshot({ request }: { request: Request }): Promise<Response> {
    try {
      const authResult = await ensureAgentAuth(request, deps)
      if (authResult instanceof Response) return authResult

      const rawBody: unknown = await request.json().catch(() => ({}))
      const parsedBody = IngestSnapshotBodySchema.safeParse(rawBody)
      if (!parsedBody.success) {
        return jsonResponse({ error: `Invalid request: ${parsedBody.error.message}` }, 400)
      }

      const body = parsedBody.data
      if (body.tenant_id !== authResult.tenantId) {
        return jsonResponse({ error: 'Forbidden' }, 403)
      }

      const runtimeAgentId = getAgentId(request)
      const startedAtMs = Date.now()
      const nowIso = new Date().toISOString()

      const leasedRequest = await deps.findLeasedSyncRequest({
        tenantId: body.tenant_id,
        syncRequestId: body.sync_request_id,
        agentId: authResult.agentId,
      })

      if (!leasedRequest) {
        await runTelemetrySafely(async () => {
          await deps.updateAgentRuntimeState({
            agentId: authResult.agentId,
            tenantId: authResult.tenantId,
            lastSeenAt: nowIso,
            processingState: 'idle',
            leaseHealth: 'conflict',
            activeJobs: 0,
            lastError: 'Lease conflict: sync request is no longer leased by this agent',
          })
          await deps.recordAgentActivity({
            agentId: authResult.agentId,
            tenantId: authResult.tenantId,
            type: 'LEASE_CONFLICT',
            message: `Lease conflict for sync_request ${body.sync_request_id}`,
            severity: 'warning',
            metadata: {
              syncRequestId: body.sync_request_id,
              runtimeAgentId,
            },
            occurredAt: nowIso,
          })
        })

        return jsonResponse({ error: 'lease_conflict' }, 409, IngestLeaseConflictResponseSchema)
      }

      if (!hasSameTarget(leasedRequest, body.provider, body.ref.value)) {
        await runTelemetrySafely(async () => {
          await deps.recordAgentActivity({
            agentId: authResult.agentId,
            tenantId: authResult.tenantId,
            type: 'REQUEST_FAILED',
            message: `Sync request target mismatch for ${body.sync_request_id}`,
            severity: 'danger',
            metadata: {
              syncRequestId: body.sync_request_id,
              provider: body.provider,
              ref: body.ref.value,
              runtimeAgentId,
            },
            occurredAt: nowIso,
          })
        })

        return jsonResponse({ error: 'sync_request target does not match payload' }, 400)
      }

      const containerCandidates = await deps.findContainersByNumber({
        containerNumbers: [body.ref.value],
      })

      const normalizedRefValue = normalizeContainerNumber(body.ref.value)
      const matchingContainers = containerCandidates.filter((container) => {
        return (
          normalizeContainerNumber(container.containerNumber) === normalizedRefValue &&
          normalizeCarrierCode(container.carrierCode) === body.provider
        )
      })

      if (matchingContainers.length !== 1) {
        const errorMessage = buildResolveErrorMessage(
          body.provider,
          body.ref.value,
          matchingContainers.length,
        )

        const markedFailed = await deps.markSyncRequestFailed({
          tenantId: body.tenant_id,
          syncRequestId: body.sync_request_id,
          agentId: authResult.agentId,
          errorMessage,
        })

        if (!markedFailed) {
          return jsonResponse({ error: 'lease_conflict' }, 409, IngestLeaseConflictResponseSchema)
        }

        await runTelemetrySafely(async () => {
          await deps.updateAgentRuntimeState({
            agentId: authResult.agentId,
            tenantId: authResult.tenantId,
            lastSeenAt: nowIso,
            processingState: 'backing_off',
            leaseHealth: 'healthy',
            activeJobs: 0,
            lastError: errorMessage,
          })
          await deps.recordAgentActivity({
            agentId: authResult.agentId,
            tenantId: authResult.tenantId,
            type: 'REQUEST_FAILED',
            message: errorMessage,
            severity: 'danger',
            metadata: {
              syncRequestId: body.sync_request_id,
              provider: body.provider,
              ref: body.ref.value,
              runtimeAgentId,
            },
            occurredAt: nowIso,
          })
        })

        return jsonResponse({ error: errorMessage }, 422)
      }

      const container = matchingContainers[0]
      if (container === undefined) {
        return jsonResponse({ error: 'Container resolution failed' }, 422)
      }

      const saveResult = await deps.saveAndProcess({
        containerId: container.id,
        containerNumber: container.containerNumber,
        provider: body.provider,
        payload: body.raw,
        parseError: body.parse_error ?? null,
        fetchedAt: body.observed_at,
      })

      const parseError = body.parse_error
      if (parseError !== null && parseError !== undefined) {
        const markedFailed = await deps.markSyncRequestFailed({
          tenantId: body.tenant_id,
          syncRequestId: body.sync_request_id,
          agentId: authResult.agentId,
          errorMessage: parseError,
        })

        if (!markedFailed) {
          return jsonResponse(
            { error: 'lease_conflict', snapshot_id: saveResult.snapshotId },
            409,
            IngestLeaseConflictResponseSchema,
          )
        }

        await runTelemetrySafely(async () => {
          await deps.updateAgentRuntimeState({
            agentId: authResult.agentId,
            tenantId: authResult.tenantId,
            lastSeenAt: nowIso,
            processingState: 'backing_off',
            leaseHealth: 'healthy',
            activeJobs: 0,
            lastError: parseError,
          })
          await deps.recordAgentActivity({
            agentId: authResult.agentId,
            tenantId: authResult.tenantId,
            type: 'REQUEST_FAILED',
            message: parseError,
            severity: 'danger',
            metadata: {
              syncRequestId: body.sync_request_id,
              snapshotId: saveResult.snapshotId,
              provider: body.provider,
              ref: body.ref.value,
              runtimeAgentId,
            },
            occurredAt: nowIso,
          })
        })

        return jsonResponse(
          { error: parseError, snapshot_id: saveResult.snapshotId },
          422,
          IngestSnapshotFailedResponseSchema,
        )
      }

      const markedDone = await deps.markSyncRequestDone({
        tenantId: body.tenant_id,
        syncRequestId: body.sync_request_id,
        agentId: authResult.agentId,
      })

      if (!markedDone) {
        await runTelemetrySafely(async () => {
          await deps.recordAgentActivity({
            agentId: authResult.agentId,
            tenantId: authResult.tenantId,
            type: 'LEASE_CONFLICT',
            message: `Lease conflict while finalizing ${body.sync_request_id}`,
            severity: 'warning',
            metadata: {
              syncRequestId: body.sync_request_id,
              snapshotId: saveResult.snapshotId,
              runtimeAgentId,
            },
            occurredAt: nowIso,
          })
        })

        return jsonResponse(
          { error: 'lease_conflict', snapshot_id: saveResult.snapshotId },
          409,
          IngestLeaseConflictResponseSchema,
        )
      }

      const parsedMeta = body.meta
      const requestedDurationMs = extractDurationMs(parsedMeta)
      const observedDurationMs = Math.max(0, Date.now() - startedAtMs)
      const durationMs = requestedDurationMs ?? observedDurationMs

      await runTelemetrySafely(async () => {
        await deps.updateAgentRuntimeState({
          agentId: authResult.agentId,
          tenantId: authResult.tenantId,
          lastSeenAt: nowIso,
          processingState: 'idle',
          leaseHealth: 'healthy',
          activeJobs: 0,
          lastError: null,
        })
        await deps.recordAgentActivity({
          agentId: authResult.agentId,
          tenantId: authResult.tenantId,
          type: 'SNAPSHOT_INGESTED',
          message: `Ingested ${body.provider}:${body.ref.value}`,
          severity: 'success',
          metadata: {
            syncRequestId: body.sync_request_id,
            snapshotId: saveResult.snapshotId,
            provider: body.provider,
            ref: body.ref.value,
            durationMs,
            runtimeAgentId,
          },
          occurredAt: nowIso,
        })
      })

      return jsonResponse(
        {
          ok: true,
          snapshot_id: saveResult.snapshotId,
        },
        202,
        IngestSnapshotAcceptedResponseSchema,
      )
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  return {
    getTargets,
    ingestSnapshot,
  }
}

export type AgentSyncControllers = ReturnType<typeof createAgentSyncControllers>
