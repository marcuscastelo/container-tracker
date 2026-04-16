import type { AgentMonitoringUseCases } from '~/modules/agent/application/agent-monitoring.usecases'
import { toUniqueNormalizedVersions } from '~/modules/agent/application/normalize-blocked-versions'
import {
  toAgentDetailCommand,
  toAgentLogIngestCommand,
  toAgentLogsCommand,
  toHeartbeatActivityCommands,
  toHeartbeatCommand,
  toListAgentsCommand,
} from '~/modules/agent/interface/http/agent-monitoring.http.mappers'
import {
  AgentControlStateResponseSchema,
  AgentDetailResponseSchema,
  AgentHeartbeatBodySchema,
  AgentHeartbeatResponseSchema,
  AgentListQuerySchema,
  AgentListResponseSchema,
  AgentLogIngestBodySchema,
  AgentLogIngestResponseSchema,
  AgentLogsQuerySchema,
  AgentLogsResponseSchema,
  AgentRemotePolicyOperationResponseSchema,
  AgentRemotePolicyPatchBodySchema,
  AgentRequestOperationResponseSchema,
  AgentRequestResetBodySchema,
  AgentRequestRestartBodySchema,
  AgentRequestUpdateBodySchema,
  AgentUpdateManifestResponseSchema,
} from '~/modules/agent/interface/http/agent-monitoring.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'

type AgentMonitoringControllersDeps = {
  readonly defaultTenantId: string
  readonly agentMonitoringUseCases: Pick<
    AgentMonitoringUseCases,
    | 'listAgents'
    | 'getAgentDetail'
    | 'getAgentLogs'
    | 'authenticateAgentToken'
    | 'touchHeartbeat'
    | 'ingestAgentLogs'
    | 'recordActivity'
    | 'getRemoteControlState'
    | 'updateAgentRemotePolicy'
    | 'requestAgentReset'
    | 'requestAgentUpdate'
    | 'requestAgentRestart'
    | 'getUpdateManifestForAgent'
  >
}

function getBearerToken(authorization: string | null): string | null {
  if (!authorization) return null
  const [scheme, token] = authorization.trim().split(/\s+/u)
  if (scheme !== 'Bearer' || !token) return null
  return token
}

export function createAgentMonitoringControllers(deps: AgentMonitoringControllersDeps) {
  async function listAgents({ request }: { readonly request: Request }): Promise<Response> {
    try {
      const url = new URL(request.url)
      const parsedQuery = AgentListQuerySchema.safeParse({
        search: url.searchParams.get('search') ?? undefined,
        status: url.searchParams.get('status') ?? undefined,
        capability: url.searchParams.get('capability') ?? undefined,
        only_problematic: url.searchParams.get('only_problematic') ?? undefined,
        sort_field: url.searchParams.get('sort_field') ?? undefined,
        sort_dir: url.searchParams.get('sort_dir') ?? undefined,
      })

      if (!parsedQuery.success) {
        return jsonResponse({ error: `Invalid query: ${parsedQuery.error.message}` }, 400)
      }

      const result = await deps.agentMonitoringUseCases.listAgents(
        toListAgentsCommand({
          tenantId: deps.defaultTenantId,
          query: parsedQuery.data,
        }),
      )

      const response = {
        agents: result.agents.map((agent) => ({
          ...agent,
          capabilities: [...agent.capabilities],
        })),
        summary: {
          ...result.summary,
        },
      }

      return jsonResponse(response, 200, AgentListResponseSchema)
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function getAgentById({
    params,
  }: {
    readonly params: { readonly id?: string }
  }): Promise<Response> {
    try {
      const agentId = params.id
      if (!agentId) {
        return jsonResponse({ error: 'Agent ID is required' }, 400)
      }

      const result = await deps.agentMonitoringUseCases.getAgentDetail(
        toAgentDetailCommand({
          tenantId: deps.defaultTenantId,
          agentId,
        }),
      )

      if (!result) {
        return jsonResponse({ error: 'Agent not found' }, 404)
      }

      const response = {
        ...result,
        capabilities: [...result.capabilities],
        recentActivity: result.recentActivity.map((event) => ({ ...event })),
      }

      return jsonResponse(response, 200, AgentDetailResponseSchema)
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function getAgentLogs({
    params,
    request,
  }: {
    readonly params: { readonly id?: string }
    readonly request: Request
  }): Promise<Response> {
    try {
      const agentId = params.id
      if (!agentId) {
        return jsonResponse({ error: 'Agent ID is required' }, 400)
      }

      const url = new URL(request.url)
      const parsedQuery = AgentLogsQuerySchema.safeParse({
        channel: url.searchParams.get('channel') ?? undefined,
        tail: url.searchParams.get('tail') ?? undefined,
      })
      if (!parsedQuery.success) {
        return jsonResponse({ error: `Invalid query: ${parsedQuery.error.message}` }, 400)
      }

      const result = await deps.agentMonitoringUseCases.getAgentLogs(
        toAgentLogsCommand({
          tenantId: deps.defaultTenantId,
          agentId,
          query: parsedQuery.data,
        }),
      )
      if (!result) {
        return jsonResponse({ error: 'Agent not found' }, 404)
      }

      return jsonResponse(
        {
          agentId: result.agentId,
          os: result.os,
          logsSupported: result.logsSupported,
          lastLogAt: result.lastLogAt,
          lines: result.lines.map((line) => ({ ...line })),
        },
        200,
        AgentLogsResponseSchema,
      )
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function getAgentControlState({
    params,
  }: {
    readonly params: { readonly id?: string }
  }): Promise<Response> {
    try {
      const agentId = params.id
      if (!agentId) {
        return jsonResponse({ error: 'Agent ID is required' }, 400)
      }

      const result = await deps.agentMonitoringUseCases.getRemoteControlState({
        tenantId: deps.defaultTenantId,
        agentId,
      })

      if (!result) {
        return jsonResponse({ error: 'Agent not found' }, 404)
      }

      return jsonResponse(
        {
          policy: {
            desiredVersion: result.policy.desiredVersion,
            updateChannel: result.policy.updateChannel,
            updatesPaused: result.policy.updatesPaused,
            blockedVersions: [...result.policy.blockedVersions],
            restartRequestedAt: result.policy.restartRequestedAt,
          },
          commands: result.commands.map((command) => ({
            id: command.id,
            type: command.type,
            payload: command.payload,
            requestedAt: command.requestedAt,
          })),
        },
        200,
        AgentControlStateResponseSchema,
      )
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function heartbeat({ request }: { readonly request: Request }): Promise<Response> {
    try {
      const providedToken = getBearerToken(request.headers.get('authorization'))
      if (!providedToken) {
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }

      const auth = await deps.agentMonitoringUseCases.authenticateAgentToken({
        token: providedToken,
      })
      if (!auth) {
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }

      const rawBody: unknown = await request.json().catch(() => ({}))
      const parsedBody = AgentHeartbeatBodySchema.safeParse(rawBody)
      if (!parsedBody.success) {
        return jsonResponse({ error: `Invalid request: ${parsedBody.error.message}` }, 400)
      }

      const payload = parsedBody.data
      if (payload.tenant_id !== auth.tenantId) {
        return jsonResponse({ error: 'Forbidden' }, 403)
      }

      await deps.agentMonitoringUseCases.touchHeartbeat(
        toHeartbeatCommand({
          authenticatedAgentId: auth.agentId,
          tenantId: auth.tenantId,
          payload,
        }),
      )

      const activityCommands = toHeartbeatActivityCommands({
        authenticatedAgentId: auth.agentId,
        tenantId: auth.tenantId,
        payload,
      })
      if (activityCommands.length > 0) {
        await deps.agentMonitoringUseCases.recordActivity(activityCommands)
      }

      return jsonResponse(
        {
          ok: true,
          updatedAt: new Date().toISOString(),
        },
        200,
        AgentHeartbeatResponseSchema,
      )
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function ingestLogs({ request }: { readonly request: Request }): Promise<Response> {
    try {
      const providedToken = getBearerToken(request.headers.get('authorization'))
      if (!providedToken) {
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }

      const auth = await deps.agentMonitoringUseCases.authenticateAgentToken({
        token: providedToken,
      })
      if (!auth) {
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }

      const rawBody: unknown = await request.json().catch(() => ({}))
      const parsedBody = AgentLogIngestBodySchema.safeParse(rawBody)
      if (!parsedBody.success) {
        return jsonResponse({ error: `Invalid request: ${parsedBody.error.message}` }, 400)
      }

      const result = await deps.agentMonitoringUseCases.ingestAgentLogs(
        toAgentLogIngestCommand({
          tenantId: auth.tenantId,
          agentId: auth.agentId,
          payload: parsedBody.data,
        }),
      )

      return jsonResponse(
        {
          ok: true,
          accepted: result.accepted,
          persisted: result.persisted,
          updatedAt: new Date().toISOString(),
        },
        200,
        AgentLogIngestResponseSchema,
      )
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function getUpdateManifest({ request }: { readonly request: Request }): Promise<Response> {
    try {
      const providedToken = getBearerToken(request.headers.get('authorization'))
      if (!providedToken) {
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }

      const auth = await deps.agentMonitoringUseCases.authenticateAgentToken({
        token: providedToken,
      })
      if (!auth) {
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }

      const manifest = await deps.agentMonitoringUseCases.getUpdateManifestForAgent({
        tenantId: auth.tenantId,
        agentId: auth.agentId,
      })

      if (!manifest) {
        return jsonResponse({ error: 'Agent not found' }, 404)
      }

      return jsonResponse(
        {
          version: manifest.version,
          download_url: manifest.downloadUrl,
          checksum: manifest.checksum,
          channel: manifest.channel,
          update_available: manifest.updateAvailable,
          desired_version: manifest.desiredVersion,
          current_version: manifest.currentVersion,
          update_ready_version: manifest.updateReadyVersion,
          restart_required: manifest.restartRequired,
          restart_requested_at: manifest.restartRequestedAt,
        },
        200,
        AgentUpdateManifestResponseSchema,
      )
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function requestAgentUpdate({
    params,
    request,
  }: {
    readonly params: { readonly id?: string }
    readonly request: Request
  }): Promise<Response> {
    try {
      const agentId = params.id
      if (!agentId) {
        return jsonResponse({ error: 'Agent ID is required' }, 400)
      }

      const rawBody: unknown = await request.json().catch(() => ({}))
      const parsedBody = AgentRequestUpdateBodySchema.safeParse(rawBody)
      if (!parsedBody.success) {
        return jsonResponse({ error: `Invalid request: ${parsedBody.error.message}` }, 400)
      }

      const requestedAt = new Date().toISOString()
      const updated = await deps.agentMonitoringUseCases.requestAgentUpdate({
        tenantId: deps.defaultTenantId,
        agentId,
        desiredVersion: parsedBody.data.desired_version,
        updateChannel: parsedBody.data.update_channel,
        requestedAt,
      })

      if (!updated) {
        return jsonResponse({ error: 'Agent not found' }, 404)
      }

      await deps.agentMonitoringUseCases.recordActivity({
        agentId,
        tenantId: deps.defaultTenantId,
        type: 'REMOTE_FORCE_UPDATE',
        message: `Update requested to ${parsedBody.data.desired_version}`,
        severity: 'info',
        metadata: {
          desiredVersion: parsedBody.data.desired_version,
          updateChannel: parsedBody.data.update_channel,
          reason: parsedBody.data.reason,
        },
        occurredAt: requestedAt,
      })

      return jsonResponse(
        {
          ok: true,
          agentId,
          requestedAt,
        },
        200,
        AgentRequestOperationResponseSchema,
      )
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function updateAgentRemotePolicy({
    params,
    request,
  }: {
    readonly params: { readonly id?: string }
    readonly request: Request
  }): Promise<Response> {
    try {
      const agentId = params.id
      if (!agentId) {
        return jsonResponse({ error: 'Agent ID is required' }, 400)
      }

      const rawBody: unknown = await request.json().catch(() => ({}))
      const parsedBody = AgentRemotePolicyPatchBodySchema.safeParse(rawBody)
      if (!parsedBody.success) {
        return jsonResponse({ error: `Invalid request: ${parsedBody.error.message}` }, 400)
      }

      const requestedAt = new Date().toISOString()
      const updated = await deps.agentMonitoringUseCases.updateAgentRemotePolicy({
        tenantId: deps.defaultTenantId,
        agentId,
        ...(parsedBody.data.updates_paused === undefined
          ? {}
          : { updatesPaused: parsedBody.data.updates_paused }),
        ...(parsedBody.data.update_channel === undefined
          ? {}
          : { updateChannel: parsedBody.data.update_channel }),
        ...(parsedBody.data.blocked_versions === undefined
          ? {}
          : { blockedVersions: toUniqueNormalizedVersions(parsedBody.data.blocked_versions) }),
        ...(parsedBody.data.desired_version === undefined
          ? {}
          : { desiredVersion: parsedBody.data.desired_version }),
      })

      if (!updated) {
        return jsonResponse({ error: 'Agent not found' }, 404)
      }

      const activity: Array<{
        readonly agentId: string
        readonly tenantId: string
        readonly type: 'CHANNEL_CHANGED' | 'CONFIG_UPDATED' | 'REMOTE_FORCE_UPDATE'
        readonly message: string
        readonly severity: 'info' | 'warning'
        readonly metadata: Record<string, unknown>
        readonly occurredAt: string
      }> = []
      const reason = parsedBody.data.reason

      if (parsedBody.data.update_channel !== undefined) {
        activity.push({
          agentId,
          tenantId: deps.defaultTenantId,
          type: 'CHANNEL_CHANGED',
          message: `Remote update channel set to ${parsedBody.data.update_channel}`,
          severity: 'info',
          metadata: {
            updateChannel: parsedBody.data.update_channel,
            reason,
          },
          occurredAt: requestedAt,
        })
      }

      if (parsedBody.data.updates_paused !== undefined) {
        activity.push({
          agentId,
          tenantId: deps.defaultTenantId,
          type: 'CONFIG_UPDATED',
          message: parsedBody.data.updates_paused
            ? 'Remote updates pause enabled'
            : 'Remote updates pause disabled',
          severity: 'warning',
          metadata: {
            updatesPaused: parsedBody.data.updates_paused,
            reason,
          },
          occurredAt: requestedAt,
        })
      }

      if (parsedBody.data.blocked_versions !== undefined) {
        activity.push({
          agentId,
          tenantId: deps.defaultTenantId,
          type: 'CONFIG_UPDATED',
          message: 'Remote blocked versions updated',
          severity: 'info',
          metadata: {
            blockedVersions: toUniqueNormalizedVersions(parsedBody.data.blocked_versions),
            reason,
          },
          occurredAt: requestedAt,
        })
      }

      if (parsedBody.data.desired_version !== undefined) {
        if (parsedBody.data.desired_version === null) {
          activity.push({
            agentId,
            tenantId: deps.defaultTenantId,
            type: 'CONFIG_UPDATED',
            message: 'Remote desired version cleared',
            severity: 'info',
            metadata: {
              desiredVersion: null,
              reason,
            },
            occurredAt: requestedAt,
          })
        } else {
          activity.push({
            agentId,
            tenantId: deps.defaultTenantId,
            type: 'REMOTE_FORCE_UPDATE',
            message: `Remote desired version set to ${parsedBody.data.desired_version}`,
            severity: 'warning',
            metadata: {
              desiredVersion: parsedBody.data.desired_version,
              reason,
            },
            occurredAt: requestedAt,
          })
        }
      }

      if (activity.length > 0) {
        await deps.agentMonitoringUseCases.recordActivity(activity)
      }

      return jsonResponse(
        {
          ok: true,
          agentId,
          requestedAt,
        },
        200,
        AgentRemotePolicyOperationResponseSchema,
      )
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function requestAgentRestart({
    params,
    request,
  }: {
    readonly params: { readonly id?: string }
    readonly request: Request
  }): Promise<Response> {
    try {
      const agentId = params.id
      if (!agentId) {
        return jsonResponse({ error: 'Agent ID is required' }, 400)
      }

      const rawBody: unknown = await request.json().catch(() => ({}))
      const parsedBody = AgentRequestRestartBodySchema.safeParse(rawBody)
      if (!parsedBody.success) {
        return jsonResponse({ error: `Invalid request: ${parsedBody.error.message}` }, 400)
      }

      const requestedAt = new Date().toISOString()
      const updated = await deps.agentMonitoringUseCases.requestAgentRestart({
        tenantId: deps.defaultTenantId,
        agentId,
        requestedAt,
      })

      if (!updated) {
        return jsonResponse({ error: 'Agent not found' }, 404)
      }

      await deps.agentMonitoringUseCases.recordActivity({
        agentId,
        tenantId: deps.defaultTenantId,
        type: 'RESTART_FOR_UPDATE',
        message: 'Manual restart requested by control plane',
        severity: 'warning',
        metadata: {
          reason: parsedBody.data.reason,
        },
        occurredAt: requestedAt,
      })

      return jsonResponse(
        {
          ok: true,
          agentId,
          requestedAt,
        },
        200,
        AgentRequestOperationResponseSchema,
      )
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function requestAgentReset({
    params,
    request,
  }: {
    readonly params: { readonly id?: string }
    readonly request: Request
  }): Promise<Response> {
    try {
      const agentId = params.id
      if (!agentId) {
        return jsonResponse({ error: 'Agent ID is required' }, 400)
      }

      const rawBody: unknown = await request.json().catch(() => ({}))
      const parsedBody = AgentRequestResetBodySchema.safeParse(rawBody)
      if (!parsedBody.success) {
        return jsonResponse({ error: `Invalid request: ${parsedBody.error.message}` }, 400)
      }

      const requestedAt = new Date().toISOString()
      const updated = await deps.agentMonitoringUseCases.requestAgentReset({
        tenantId: deps.defaultTenantId,
        agentId,
        requestedAt,
      })

      if (!updated) {
        return jsonResponse({ error: 'Agent not found' }, 404)
      }

      await deps.agentMonitoringUseCases.recordActivity({
        agentId,
        tenantId: deps.defaultTenantId,
        type: 'REMOTE_RESET',
        message: 'Remote reset requested by control plane',
        severity: 'warning',
        metadata: {
          reason: parsedBody.data.reason,
        },
        occurredAt: requestedAt,
      })

      return jsonResponse(
        {
          ok: true,
          agentId,
          requestedAt,
        },
        200,
        AgentRequestOperationResponseSchema,
      )
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  return {
    listAgents,
    getAgentById,
    getAgentLogs,
    getAgentControlState,
    heartbeat,
    ingestLogs,
    getUpdateManifest,
    updateAgentRemotePolicy,
    requestAgentUpdate,
    requestAgentRestart,
    requestAgentReset,
  }
}

export type AgentMonitoringControllers = ReturnType<typeof createAgentMonitoringControllers>
