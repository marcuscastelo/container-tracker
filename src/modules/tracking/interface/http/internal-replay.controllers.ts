import type { TrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import {
  toReplayLookupResponse,
  toReplayRollbackResponse,
  toReplayRunExecutionResponse,
  toReplayRunResponse,
} from '~/modules/tracking/interface/http/internal-replay.http-mappers'
import {
  internalReplayEnabledResponse,
  internalReplayNotFoundResponse,
} from '~/modules/tracking/interface/http/internal-replay.responses'
import {
  ReplayLookupRequestSchema,
  ReplayLookupResponseSchema,
  ReplayRollbackResponseSchema,
  ReplayRunActionRequestSchema,
  ReplayRunResponseSchema,
} from '~/modules/tracking/interface/http/internal-replay.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse, parseBody } from '~/shared/api/typedRoute'

type InternalReplayControllersDeps = {
  readonly trackingUseCases: Pick<
    TrackingUseCases,
    | 'lookupTrackingReplayTarget'
    | 'previewTrackingReplay'
    | 'applyTrackingReplay'
    | 'rollbackTrackingReplay'
    | 'getTrackingReplayRun'
  >
  readonly isEnabled: () => boolean
  readonly authenticateRequest: (request: Request) => boolean
  readonly resolveCodeVersion: () => string | null
}

function resolveRequestedBy(request: Request): string {
  const fromHeader = request.headers.get('x-internal-user')?.trim()
  if (fromHeader && fromHeader.length > 0) {
    return fromHeader
  }

  return 'internal-tracking-replay-ui'
}

function normalizeReason(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function createInternalReplayControllers(deps: InternalReplayControllersDeps) {
  function guardEnabled(): Response | null {
    if (deps.isEnabled()) {
      return null
    }

    return internalReplayNotFoundResponse()
  }

  function guardAuthorized(request: Request): Response | null {
    const disabled = guardEnabled()
    if (disabled) {
      return disabled
    }

    if (!deps.authenticateRequest(request)) {
      return internalReplayNotFoundResponse()
    }

    return null
  }

  async function enabled(): Promise<Response> {
    const disabled = guardEnabled()
    if (disabled) {
      return disabled
    }

    return internalReplayEnabledResponse()
  }

  async function lookup({ request }: { readonly request: Request }): Promise<Response> {
    try {
      const unauthorized = guardAuthorized(request)
      if (unauthorized) {
        return unauthorized
      }

      const body = await parseBody(request, ReplayLookupRequestSchema)
      const target = await deps.trackingUseCases.lookupTrackingReplayTarget({
        containerNumber: body.containerNumber,
      })

      return jsonResponse(toReplayLookupResponse(target), 200, ReplayLookupResponseSchema)
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function preview({ request }: { readonly request: Request }): Promise<Response> {
    try {
      const unauthorized = guardAuthorized(request)
      if (unauthorized) {
        return unauthorized
      }

      const body = await parseBody(request, ReplayRunActionRequestSchema)
      const result = await deps.trackingUseCases.previewTrackingReplay({
        containerId: body.containerId,
        reason: normalizeReason(body.reason),
        requestedBy: resolveRequestedBy(request),
        codeVersion: deps.resolveCodeVersion(),
      })

      return jsonResponse(toReplayRunExecutionResponse(result), 200, ReplayRunResponseSchema)
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function apply({ request }: { readonly request: Request }): Promise<Response> {
    try {
      const unauthorized = guardAuthorized(request)
      if (unauthorized) {
        return unauthorized
      }

      const body = await parseBody(request, ReplayRunActionRequestSchema)
      const result = await deps.trackingUseCases.applyTrackingReplay({
        containerId: body.containerId,
        reason: normalizeReason(body.reason),
        requestedBy: resolveRequestedBy(request),
        codeVersion: deps.resolveCodeVersion(),
      })

      return jsonResponse(toReplayRunExecutionResponse(result), 200, ReplayRunResponseSchema)
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function rollback({ request }: { readonly request: Request }): Promise<Response> {
    try {
      const unauthorized = guardAuthorized(request)
      if (unauthorized) {
        return unauthorized
      }

      const body = await parseBody(request, ReplayRunActionRequestSchema)
      const result = await deps.trackingUseCases.rollbackTrackingReplay({
        containerId: body.containerId,
        reason: normalizeReason(body.reason),
        requestedBy: resolveRequestedBy(request),
        codeVersion: deps.resolveCodeVersion(),
      })

      return jsonResponse(toReplayRollbackResponse(result), 200, ReplayRollbackResponseSchema)
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function getRun({
    params,
    request,
  }: {
    readonly params: Record<string, string>
    readonly request: Request
  }): Promise<Response> {
    try {
      const unauthorized = guardAuthorized(request)
      if (unauthorized) {
        return unauthorized
      }

      const runId = params.runId ?? ''
      const run = await deps.trackingUseCases.getTrackingReplayRun({ runId })

      return jsonResponse(toReplayRunResponse(run), 200, ReplayRunResponseSchema)
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  return {
    enabled,
    lookup,
    preview,
    apply,
    rollback,
    getRun,
  }
}

export type InternalReplayControllers = ReturnType<typeof createInternalReplayControllers>
