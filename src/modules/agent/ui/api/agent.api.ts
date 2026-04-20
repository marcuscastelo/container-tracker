import type { z } from 'zod/v4'

import {
  AgentControlStateResponseSchema,
  AgentDetailResponseSchema,
  AgentListResponseSchema,
  AgentLogsResponseSchema,
  AgentRemotePolicyOperationResponseSchema,
  AgentRequestOperationResponseSchema,
} from '~/modules/agent/interface/http/agent-monitoring.schemas'
import { TypedFetchError, typedFetch } from '~/shared/api/typedFetch'

type AgentListResponseDto = z.infer<typeof AgentListResponseSchema>
type AgentDetailResponseDto = z.infer<typeof AgentDetailResponseSchema>
type AgentLogsResponseDto = z.infer<typeof AgentLogsResponseSchema>
type AgentRequestOperationDto = z.infer<typeof AgentRequestOperationResponseSchema>
type AgentControlStateDto = z.infer<typeof AgentControlStateResponseSchema>
type AgentRemotePolicyOperationDto = z.infer<typeof AgentRemotePolicyOperationResponseSchema>

export type AgentSummaryPayload = AgentListResponseDto['agents'][number]
export type AgentFleetSummary = AgentListResponseDto['summary']
export type AgentDetailPayload = AgentDetailResponseDto
export type AgentStatus = AgentSummaryPayload['status']
export type AgentActivityType = AgentDetailPayload['recentActivity'][number]['type']
export type AgentActivitySeverity = AgentDetailPayload['recentActivity'][number]['severity']
export type AgentActivityEntry = AgentDetailPayload['recentActivity'][number]
export type AgentLogLinePayload = AgentLogsResponseDto['lines'][number]
export type AgentLogsChannel = 'stdout' | 'stderr' | 'both'
export type AgentControlStatePayload = AgentControlStateDto

export type AgentListQuery = {
  readonly search?: string
  readonly status?: 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED' | 'UNKNOWN'
  readonly capability?: string
  readonly onlyProblematic?: boolean
  readonly sortField?: 'status' | 'tenant' | 'lastSeen' | 'failures' | 'queueLag' | 'activeJobs'
  readonly sortDir?: 'asc' | 'desc'
}

type AgentLogsQuery = {
  readonly channel?: AgentLogsChannel
  readonly tail?: number
}

function toAgentListPath(query: AgentListQuery | undefined): string {
  const searchParams = new URLSearchParams()
  if (!query) return '/api/agents'

  if (typeof query.search === 'string' && query.search.trim().length > 0) {
    searchParams.set('search', query.search.trim())
  }
  if (typeof query.status === 'string') {
    searchParams.set('status', query.status)
  }
  if (typeof query.capability === 'string' && query.capability.trim().length > 0) {
    searchParams.set('capability', query.capability.trim())
  }
  if (query.onlyProblematic === true) {
    searchParams.set('only_problematic', 'true')
  }
  if (typeof query.sortField === 'string') {
    searchParams.set('sort_field', query.sortField)
  }
  if (typeof query.sortDir === 'string') {
    searchParams.set('sort_dir', query.sortDir)
  }

  const qs = searchParams.toString()
  if (qs.length === 0) return '/api/agents'
  return `/api/agents?${qs}`
}

export async function fetchAgentList(query?: AgentListQuery): Promise<AgentListResponseDto> {
  return typedFetch(toAgentListPath(query), undefined, AgentListResponseSchema)
}

export async function fetchAgentDetail(agentId: string): Promise<AgentDetailPayload | null> {
  try {
    return await typedFetch(`/api/agents/${agentId}`, undefined, AgentDetailResponseSchema)
  } catch (error) {
    if (error instanceof TypedFetchError && error.status === 404) {
      return null
    }
    throw error
  }
}

export async function requestAgentUpdate(command: {
  readonly agentId: string
  readonly desiredVersion: string
  readonly updateChannel?: string
  readonly reason: string
}): Promise<AgentRequestOperationDto> {
  return typedFetch(
    `/api/agents/${command.agentId}/request-update`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        desired_version: command.desiredVersion,
        update_channel: command.updateChannel ?? 'stable',
        reason: command.reason,
      }),
    },
    AgentRequestOperationResponseSchema,
  )
}

export async function requestAgentRestart(command: {
  readonly agentId: string
  readonly reason: string
}): Promise<AgentRequestOperationDto> {
  return typedFetch(
    `/api/agents/${command.agentId}/request-restart`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        reason: command.reason,
      }),
    },
    AgentRequestOperationResponseSchema,
  )
}

export async function requestAgentReset(command: {
  readonly agentId: string
  readonly reason: string
}): Promise<AgentRequestOperationDto> {
  return typedFetch(
    `/api/agents/${command.agentId}/request-reset`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        reason: command.reason,
      }),
    },
    AgentRequestOperationResponseSchema,
  )
}

export async function fetchAgentControlState(
  agentId: string,
): Promise<AgentControlStatePayload | null> {
  try {
    return await typedFetch(
      `/api/agents/${agentId}/control-state`,
      undefined,
      AgentControlStateResponseSchema,
    )
  } catch (error) {
    if (error instanceof TypedFetchError && error.status === 404) {
      return null
    }
    throw error
  }
}

export async function updateAgentRemotePolicy(command: {
  readonly agentId: string
  readonly reason: string
  readonly updatesPaused?: boolean
  readonly updateChannel?: string
  readonly blockedVersions?: readonly string[]
  readonly desiredVersion?: string | null
}): Promise<AgentRemotePolicyOperationDto> {
  return typedFetch(
    `/api/agents/${command.agentId}/remote-policy`,
    {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        reason: command.reason,
        ...(command.updatesPaused === undefined ? {} : { updates_paused: command.updatesPaused }),
        ...(command.updateChannel === undefined ? {} : { update_channel: command.updateChannel }),
        ...(command.blockedVersions === undefined
          ? {}
          : { blocked_versions: [...command.blockedVersions] }),
        ...(command.desiredVersion === undefined
          ? {}
          : { desired_version: command.desiredVersion }),
      }),
    },
    AgentRemotePolicyOperationResponseSchema,
  )
}

function toAgentLogsPath(command: {
  readonly agentId: string
  readonly query?: AgentLogsQuery
}): string {
  const searchParams = new URLSearchParams()
  if (command.query?.channel) {
    searchParams.set('channel', command.query.channel)
  }
  if (typeof command.query?.tail === 'number') {
    searchParams.set('tail', String(command.query.tail))
  }

  const queryString = searchParams.toString()
  if (queryString.length === 0) {
    return `/api/agents/${command.agentId}/logs`
  }

  return `/api/agents/${command.agentId}/logs?${queryString}`
}

export async function fetchAgentLogs(command: {
  readonly agentId: string
  readonly query?: AgentLogsQuery
}): Promise<AgentLogsResponseDto> {
  return typedFetch(toAgentLogsPath(command), undefined, AgentLogsResponseSchema)
}
