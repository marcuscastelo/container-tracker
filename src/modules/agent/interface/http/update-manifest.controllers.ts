import type { AgentMonitoringUseCases } from '~/modules/agent/application/agent-monitoring.usecases'
import type { AgentUpdateManifestService } from '~/modules/agent/application/update-manifest.service'
import { AgentUpdateManifestResponseSchema } from '~/modules/agent/interface/http/agent-monitoring.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'

type UpdateManifestControllersDeps = {
  readonly authenticateAgentToken: Pick<AgentMonitoringUseCases, 'authenticateAgentToken'>
  readonly updateManifestService: AgentUpdateManifestService
}

function getBearerToken(authorization: string | null): string | null {
  if (!authorization) return null
  const [scheme, token] = authorization.trim().split(/\s+/u)
  if (scheme !== 'Bearer' || !token) return null
  return token
}

function getAgentPlatform(request: Request): string | undefined {
  const headerValue = request.headers.get('x-agent-platform')
  if (!headerValue) {
    return undefined
  }

  const normalized = headerValue.trim().toLowerCase()
  return normalized.length > 0 ? normalized : undefined
}

function getAgentChannelOverride(request: Request): string | undefined {
  const headerValue = request.headers.get('x-agent-update-channel')
  if (!headerValue) {
    return undefined
  }

  const normalized = headerValue.trim().toLowerCase()
  return normalized.length > 0 ? normalized : undefined
}

export function createUpdateManifestControllers(deps: UpdateManifestControllersDeps) {
  async function getUpdateManifest({ request }: { readonly request: Request }): Promise<Response> {
    try {
      const providedToken = getBearerToken(request.headers.get('authorization'))
      if (!providedToken) {
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }

      const auth = await deps.authenticateAgentToken.authenticateAgentToken({
        token: providedToken,
      })
      if (!auth) {
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }

      const platform = getAgentPlatform(request)
      const updateChannel = getAgentChannelOverride(request)
      const result = await deps.updateManifestService.resolveForAgent(
        platform === undefined
          ? {
              tenantId: auth.tenantId,
              agentId: auth.agentId,
              ...(updateChannel === undefined ? {} : { updateChannel }),
            }
          : {
              tenantId: auth.tenantId,
              agentId: auth.agentId,
              platform,
              ...(updateChannel === undefined ? {} : { updateChannel }),
            },
      )

      if (result.kind === 'agent_not_found') {
        return jsonResponse({ error: 'Agent not found' }, 404)
      }

      if (result.kind === 'manifest_unavailable') {
        console.warn(
          `[agent:update-manifest] 204 manifest_unavailable tenant=${auth.tenantId} agent=${auth.agentId} channel=${result.channel} platform=${platform ?? 'default'} reason=${result.reason}`,
        )
        return new Response(null, {
          status: 204,
          headers: {
            'x-agent-update-status': 'manifest_unavailable',
            'x-agent-update-channel': result.channel,
            'x-agent-update-platform': platform ?? 'default',
            'x-agent-update-reason': result.reason,
          },
        })
      }

      const response = {
        version: result.manifest.version,
        download_url: result.manifest.downloadUrl,
        checksum: result.manifest.checksum,
        channel: result.manifest.channel,
        published_at: result.manifest.publishedAt,
        update_available: result.manifest.updateAvailable,
        desired_version: result.manifest.desiredVersion,
        current_version: result.manifest.currentVersion,
        update_ready_version: result.manifest.updateReadyVersion,
        restart_required: result.manifest.restartRequired,
        restart_requested_at: result.manifest.restartRequestedAt,
      }

      console.info(
        `[agent:update-manifest] 200 resolved tenant=${auth.tenantId} agent=${auth.agentId} channel=${response.channel} version=${response.version} update_available=${response.update_available} desired=${response.desired_version ?? 'none'} current=${response.current_version} update_ready=${response.update_ready_version ?? 'none'} platform=${platform ?? 'default'}`,
      )

      return jsonResponse(response, 200, AgentUpdateManifestResponseSchema)
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  return {
    getUpdateManifest,
  }
}

export type UpdateManifestControllers = ReturnType<typeof createUpdateManifestControllers>
