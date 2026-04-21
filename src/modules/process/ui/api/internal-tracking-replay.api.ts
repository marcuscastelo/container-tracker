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
  readonly authToken: string
  readonly containerId: string
  readonly reason: string | null
}

function withReplayAuth(
  authToken: string,
  init: Omit<RequestInit, 'headers'> & {
    readonly headers?: HeadersInit
  },
): RequestInit {
  const headers = new Headers(init.headers)
  const normalizedAuthToken = authToken.trim()

  if (normalizedAuthToken.length > 0) {
    headers.set('Authorization', `Bearer ${normalizedAuthToken}`)
  }

  return {
    ...init,
    headers,
  }
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
  readonly authToken: string
  readonly containerNumber: string
}): Promise<ReplayLookupResponse> {
  return typedFetch(
    '/api/internal/tracking-replay/lookup',
    withReplayAuth(command.authToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        containerNumber: command.containerNumber,
      }),
    }),
    ReplayLookupResponseSchema,
  )
}

export async function previewInternalTrackingReplay(
  payload: ReplayActionPayload,
): Promise<ReplayRunResponse> {
  return typedFetch(
    '/api/internal/tracking-replay/preview',
    withReplayAuth(payload.authToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        containerId: payload.containerId,
        reason: payload.reason,
      }),
    }),
    ReplayRunResponseSchema,
  )
}

export async function applyInternalTrackingReplay(
  payload: ReplayActionPayload,
): Promise<ReplayRunResponse> {
  return typedFetch(
    '/api/internal/tracking-replay/apply',
    withReplayAuth(payload.authToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        containerId: payload.containerId,
        reason: payload.reason,
      }),
    }),
    ReplayRunResponseSchema,
  )
}

export async function rollbackInternalTrackingReplay(
  payload: ReplayActionPayload,
): Promise<ReplayRollbackResponse> {
  return typedFetch(
    '/api/internal/tracking-replay/rollback',
    withReplayAuth(payload.authToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        containerId: payload.containerId,
        reason: payload.reason,
      }),
    }),
    ReplayRollbackResponseSchema,
  )
}

export async function fetchInternalTrackingReplayRun(command: {
  readonly authToken: string
  readonly runId: string
}): Promise<ReplayRunResponse> {
  return typedFetch(
    `/api/internal/tracking-replay/runs/${command.runId}`,
    withReplayAuth(command.authToken, {
      method: 'GET',
    }),
    ReplayRunResponseSchema,
  )
}
