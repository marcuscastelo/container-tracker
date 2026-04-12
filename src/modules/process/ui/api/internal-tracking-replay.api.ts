import {
  type ReplayEnabledResponse,
  ReplayEnabledResponseSchema,
  type ReplayLookupResponse,
  ReplayLookupResponseSchema,
  type ReplayRollbackResponse,
  ReplayRollbackResponseSchema,
  type ReplayRunResponse,
  ReplayRunResponseSchema,
} from '~/modules/tracking/interface/http/internal-replay.schemas'
import { typedFetch } from '~/shared/api/typedFetch'

type ReplayActionPayload = {
  readonly containerId: string
  readonly reason: string | null
}

export type {
  ReplayEnabledResponse,
  ReplayLookupResponse,
  ReplayRollbackResponse,
  ReplayRunResponse,
}

export async function fetchInternalTrackingReplayEnabled(): Promise<ReplayEnabledResponse> {
  return typedFetch(
    '/api/internal/tracking-replay/enabled',
    {
      method: 'GET',
    },
    ReplayEnabledResponseSchema,
  )
}

export async function lookupInternalTrackingReplayTarget(command: {
  readonly containerNumber: string
}): Promise<ReplayLookupResponse> {
  return typedFetch(
    '/api/internal/tracking-replay/lookup',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        containerNumber: command.containerNumber,
      }),
    },
    ReplayLookupResponseSchema,
  )
}

export async function previewInternalTrackingReplay(
  payload: ReplayActionPayload,
): Promise<ReplayRunResponse> {
  return typedFetch(
    '/api/internal/tracking-replay/preview',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    ReplayRunResponseSchema,
  )
}

export async function applyInternalTrackingReplay(
  payload: ReplayActionPayload,
): Promise<ReplayRunResponse> {
  return typedFetch(
    '/api/internal/tracking-replay/apply',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    ReplayRunResponseSchema,
  )
}

export async function rollbackInternalTrackingReplay(
  payload: ReplayActionPayload,
): Promise<ReplayRollbackResponse> {
  return typedFetch(
    '/api/internal/tracking-replay/rollback',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    ReplayRollbackResponseSchema,
  )
}

export async function fetchInternalTrackingReplayRun(command: {
  readonly runId: string
}): Promise<ReplayRunResponse> {
  return typedFetch(
    `/api/internal/tracking-replay/runs/${command.runId}`,
    {
      method: 'GET',
    },
    ReplayRunResponseSchema,
  )
}
