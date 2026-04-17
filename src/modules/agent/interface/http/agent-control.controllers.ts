import {
  AgentControlCommandAckBodySchema,
  AgentControlCommandAckResponseSchema,
  AgentControlStateResponseSchema,
  AgentInfraConfigResponseSchema,
} from '@agent/control-core/contracts'
import type { AgentMonitoringUseCases } from '~/modules/agent/application/agent-monitoring.usecases'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'
import { serverEnv } from '~/shared/config/server-env'

type AgentControlControllersDeps = {
  readonly agentMonitoringUseCases: Pick<
    AgentMonitoringUseCases,
    | 'authenticateAgentToken'
    | 'getRemoteControlState'
    | 'getInfraConfig'
    | 'acknowledgeRemoteControlCommand'
  >
}

type AgentControlControllers = {
  readonly getInfraConfig: (command: { readonly request: Request }) => Promise<Response>
  readonly getControlState: (command: { readonly request: Request }) => Promise<Response>
  readonly acknowledgeControlCommand: (command: {
    readonly params: { readonly id?: string }
    readonly request: Request
  }) => Promise<Response>
}

function getBearerToken(authorization: string | null): string | null {
  if (!authorization) return null
  const [scheme, token] = authorization.trim().split(/\s+/u)
  if (scheme !== 'Bearer' || !token) return null
  return token
}

export function createAgentControlControllers(
  deps: AgentControlControllersDeps,
): AgentControlControllers {
  async function authenticateRequest(request: Request) {
    const token = getBearerToken(request.headers.get('authorization'))
    if (!token) {
      return null
    }

    return deps.agentMonitoringUseCases.authenticateAgentToken({ token })
  }

  async function getInfraConfig({ request }: { readonly request: Request }): Promise<Response> {
    try {
      const auth = await authenticateRequest(request)
      if (!auth) {
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }

      const infraConfig = await deps.agentMonitoringUseCases.getInfraConfig({
        tenantId: auth.tenantId,
        agentId: auth.agentId,
      })

      const backendInfraConfig = {
        supabaseUrl: serverEnv.AGENT_ENROLL_SUPABASE_URL ?? serverEnv.SUPABASE_URL,
        supabaseAnonKey: serverEnv.AGENT_ENROLL_SUPABASE_ANON_KEY ?? null,
      }
      const response =
        backendInfraConfig.supabaseAnonKey !== null
          ? backendInfraConfig
          : (infraConfig ?? backendInfraConfig)

      if (response.supabaseAnonKey === null) {
        return jsonResponse({ error: 'Infra config unavailable' }, 404)
      }

      return jsonResponse(
        {
          supabaseUrl: response.supabaseUrl,
          supabaseAnonKey: response.supabaseAnonKey,
        },
        200,
        AgentInfraConfigResponseSchema,
      )
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function getControlState({ request }: { readonly request: Request }): Promise<Response> {
    try {
      const auth = await authenticateRequest(request)
      if (!auth) {
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }

      const result = await deps.agentMonitoringUseCases.getRemoteControlState({
        tenantId: auth.tenantId,
        agentId: auth.agentId,
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

  async function acknowledgeControlCommand({
    params,
    request,
  }: {
    readonly params: { readonly id?: string }
    readonly request: Request
  }): Promise<Response> {
    try {
      const auth = await authenticateRequest(request)
      if (!auth) {
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }

      const commandId = params.id
      if (!commandId) {
        return jsonResponse({ error: 'Command ID is required' }, 400)
      }

      const rawBody: unknown = await request.json().catch(() => ({}))
      const parsedBody = AgentControlCommandAckBodySchema.safeParse(rawBody)
      if (!parsedBody.success) {
        return jsonResponse({ error: `Invalid request: ${parsedBody.error.message}` }, 400)
      }

      const acknowledgedAt = new Date().toISOString()
      const acknowledged = await deps.agentMonitoringUseCases.acknowledgeRemoteControlCommand({
        tenantId: auth.tenantId,
        agentId: auth.agentId,
        commandId,
        acknowledgedAt,
        status: parsedBody.data.status,
        detail: parsedBody.data.detail,
      })

      if (!acknowledged) {
        return jsonResponse({ error: 'Command not found' }, 404)
      }

      return jsonResponse(
        {
          ok: true,
          commandId,
          acknowledgedAt,
        },
        200,
        AgentControlCommandAckResponseSchema,
      )
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  return {
    getInfraConfig,
    getControlState,
    acknowledgeControlCommand,
  }
}

export type { AgentControlControllers }
