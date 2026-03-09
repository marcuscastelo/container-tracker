import type { z } from 'zod/v4'

import {
  AgentDetailResponseSchema,
  AgentListResponseSchema,
} from '~/modules/agent/interface/http/agent-monitoring.schemas'
import { TypedFetchError, typedFetch } from '~/shared/api/typedFetch'

type AgentListResponseDto = z.infer<typeof AgentListResponseSchema>
type AgentDetailResponseDto = z.infer<typeof AgentDetailResponseSchema>

export type AgentSummaryPayload = AgentListResponseDto['agents'][number]
export type AgentFleetSummary = AgentListResponseDto['summary']
export type AgentDetailPayload = AgentDetailResponseDto
export type AgentStatus = AgentSummaryPayload['status']
export type AgentRealtimeState = AgentSummaryPayload['realtimeState']
export type AgentActivityType = AgentDetailPayload['recentActivity'][number]['type']
export type AgentActivitySeverity = AgentDetailPayload['recentActivity'][number]['severity']
export type AgentActivityEntry = AgentDetailPayload['recentActivity'][number]

export type AgentListQuery = {
  readonly search?: string
  readonly status?: 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED' | 'UNKNOWN'
  readonly capability?: string
  readonly onlyProblematic?: boolean
  readonly sortField?: 'status' | 'tenant' | 'lastSeen' | 'failures' | 'queueLag' | 'activeJobs'
  readonly sortDir?: 'asc' | 'desc'
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
