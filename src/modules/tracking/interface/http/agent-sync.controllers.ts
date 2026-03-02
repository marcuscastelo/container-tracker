import type { Provider } from '~/modules/tracking/domain/model/provider'
import {
  GetAgentTargetsQuerySchema,
  GetAgentTargetsResponseSchema,
  IngestLeaseConflictResponseSchema,
  IngestSnapshotAcceptedResponseSchema,
  IngestSnapshotBodySchema,
  type SyncRequestRow,
} from '~/modules/tracking/interface/http/agent-sync.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'

type ContainerLookupRecord = {
  readonly id: string
  readonly containerNumber: string
  readonly carrierCode: string
}

export type AgentSyncControllersDeps = {
  readonly leaseSyncRequests: (command: {
    readonly tenantId: string
    readonly agentId: string
    readonly limit: number
    readonly leaseMinutes: number
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
    readonly fetchedAt: string
  }) => Promise<{ readonly snapshotId: string }>
  readonly authenticateAgentToken: (command: {
    readonly token: string
  }) => Promise<{ readonly tenantId: string } | null>
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

async function ensureAgentAuth(
  request: Request,
  deps: AgentSyncControllersDeps,
): Promise<{ readonly tenantId: string } | Response> {
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

export function createAgentSyncControllers(deps: AgentSyncControllersDeps) {
  async function getTargets({ request }: { request: Request }): Promise<Response> {
    try {
      const authResult = await ensureAgentAuth(request, deps)
      if (authResult instanceof Response) return authResult

      const url = new URL(request.url)
      const parsedQuery = GetAgentTargetsQuerySchema.safeParse({
        tenant_id: url.searchParams.get('tenant_id'),
        limit: url.searchParams.get('limit') ?? undefined,
      })

      if (!parsedQuery.success) {
        return jsonResponse({ error: `Invalid query: ${parsedQuery.error.message}` }, 400)
      }

      if (parsedQuery.data.tenant_id !== authResult.tenantId) {
        return jsonResponse({ error: 'Forbidden' }, 403)
      }

      const agentId = getAgentId(request)
      const leased = await deps.leaseSyncRequests({
        tenantId: parsedQuery.data.tenant_id,
        agentId,
        limit: parsedQuery.data.limit,
        leaseMinutes: deps.leaseMinutes,
      })

      const response = {
        targets: leased.map((item) => ({
          sync_request_id: item.id,
          provider: item.provider,
          ref_type: item.ref_type,
          ref: item.ref_value,
        })),
        leased_until: leased[0]?.leased_until ?? null,
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

      const agentId = getAgentId(request)

      const leasedRequest = await deps.findLeasedSyncRequest({
        tenantId: body.tenant_id,
        syncRequestId: body.sync_request_id,
        agentId,
      })

      if (!leasedRequest) {
        return jsonResponse({ error: 'lease_conflict' }, 409, IngestLeaseConflictResponseSchema)
      }

      if (!hasSameTarget(leasedRequest, body.provider, body.ref.value)) {
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
          agentId,
          errorMessage,
        })

        if (!markedFailed) {
          return jsonResponse({ error: 'lease_conflict' }, 409, IngestLeaseConflictResponseSchema)
        }

        return jsonResponse({ error: errorMessage }, 422)
      }

      const container = matchingContainers[0]

      const saveResult = await deps.saveAndProcess({
        containerId: container.id,
        containerNumber: container.containerNumber,
        provider: body.provider,
        payload: body.raw,
        fetchedAt: body.observed_at,
      })

      const markedDone = await deps.markSyncRequestDone({
        tenantId: body.tenant_id,
        syncRequestId: body.sync_request_id,
        agentId,
      })

      if (!markedDone) {
        return jsonResponse(
          { error: 'lease_conflict', snapshot_id: saveResult.snapshotId },
          409,
          IngestLeaseConflictResponseSchema,
        )
      }

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
