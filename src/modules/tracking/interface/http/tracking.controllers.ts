/**
 * Tracking controllers — HTTP boundary for tracking operations.
 *
 * Pattern: routes → controller → usecase (per architecture guide §10)
 */

import type { TrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import {
  toAlertResponseDto,
  toSnapshotResponseDto,
  toTrackingReplayResultResponseDto,
  toTrackingReplayStepSnapshotResponseDto,
  toTrackingReplayStepsResponseDto,
} from '~/modules/tracking/interface/http/tracking.http.mappers'
import {
  AlertActionBodySchema,
  GetLatestSnapshotRequestSchema,
  GetSnapshotsForContainerRequestSchema,
  GetTrackingReplayRequestSchema,
  GetTrackingReplayStepSnapshotRequestSchema,
  GetTrackingReplayStepsQuerySchema,
  ListAlertsQuerySchema,
  TrackingReplayResultResponseDtoSchema,
  TrackingReplayStepSnapshotResponseDtoSchema,
  TrackingReplayStepsResponseDtoSchema,
} from '~/modules/tracking/interface/http/tracking.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'

// ---------------------------------------------------------------------------
// Dependency types
// ---------------------------------------------------------------------------

type TrackingControllersDeps = {
  readonly trackingUseCases: TrackingUseCases
}

// ---------------------------------------------------------------------------
// Alerts controller factory
// ---------------------------------------------------------------------------

function createAlertsController(trackingUseCases: TrackingUseCases) {
  // GET /api/alerts?container_id=<uuid>
  async function listAlerts({ request }: { request: Request }): Promise<Response> {
    try {
      const url = new URL(request.url)
      const rawContainerId = url.searchParams.get('container_id')

      const queryResult = ListAlertsQuerySchema.safeParse({ container_id: rawContainerId })
      if (!queryResult.success) {
        return jsonResponse({ error: queryResult.error.message }, 400)
      }

      const containerId = queryResult.data.container_id

      const { alerts } = await trackingUseCases.listActiveAlertsByContainerId(containerId)

      const response = alerts.map(toAlertResponseDto)
      return jsonResponse(response, 200)
    } catch (err) {
      console.error('GET /api/alerts error:', err)
      return mapErrorToResponse(err)
    }
  }

  // PATCH /api/alerts — acknowledge or unacknowledge
  async function handleAlertAction({ request }: { request: Request }): Promise<Response> {
    try {
      const raw: unknown = await request.json().catch(() => ({}))
      const parsed = AlertActionBodySchema.safeParse(raw)
      if (!parsed.success) {
        return jsonResponse({ error: `Invalid request: ${parsed.error.message}` }, 400)
      }

      const { alert_id, action, acked_by, acked_source } = parsed.data

      if (action === 'acknowledge') {
        await trackingUseCases.acknowledgeAlert(alert_id, {
          ackedBy: acked_by ?? null,
          ackedSource: acked_source ?? null,
        })
      } else {
        await trackingUseCases.unacknowledgeAlert(alert_id)
      }

      return jsonResponse({ ok: true, alert_id, action }, 200)
    } catch (err) {
      console.error('PATCH /api/alerts error:', err)
      return mapErrorToResponse(err)
    }
  }

  return { listAlerts, handleAlertAction }
}

// ---------------------------------------------------------------------------
// Snapshots controller factory
// ---------------------------------------------------------------------------

function createSnapshotsController(trackingUseCases: TrackingUseCases) {
  // GET /api/tracking/containers/:containerId/snapshots
  async function getSnapshotsForContainer({
    params,
  }: {
    params: Record<string, string>
  }): Promise<Response> {
    try {
      const parsed = GetSnapshotsForContainerRequestSchema.safeParse({
        containerId: params.containerId,
      })
      if (!parsed.success) {
        return jsonResponse({ error: parsed.error.message }, 400)
      }

      const snapshots = await trackingUseCases.getSnapshotsForContainer(parsed.data.containerId)
      return jsonResponse(snapshots.map(toSnapshotResponseDto), 200)
    } catch (err) {
      console.error('GET /api/tracking/containers/:containerId/snapshots error:', err)
      return mapErrorToResponse(err)
    }
  }

  // GET /api/tracking/containers/:containerId/snapshots/latest
  async function getLatestSnapshot({
    params,
  }: {
    params: Record<string, string>
  }): Promise<Response> {
    try {
      const parsed = GetLatestSnapshotRequestSchema.safeParse({
        containerId: params.containerId,
      })
      if (!parsed.success) {
        return jsonResponse({ error: parsed.error.message }, 400)
      }

      const snapshot = await trackingUseCases.getLatestSnapshot(parsed.data.containerId)
      if (!snapshot) {
        return jsonResponse({ error: 'No snapshot found' }, 404)
      }

      return jsonResponse(toSnapshotResponseDto(snapshot), 200)
    } catch (err) {
      console.error('GET /api/tracking/containers/:containerId/snapshots/latest error:', err)
      return mapErrorToResponse(err)
    }
  }

  return { getSnapshotsForContainer, getLatestSnapshot }
}

function createReplayController(trackingUseCases: TrackingUseCases) {
  function parseReplayNow(rawNow: string | undefined): Date | null {
    if (typeof rawNow !== 'string' || rawNow.trim().length === 0) return new Date()
    const parsed = new Date(rawNow)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed
  }

  async function getReplay({
    params,
    request,
  }: {
    params: Record<string, string>
    request: Request
  }): Promise<Response> {
    try {
      const url = new URL(request.url)
      const parsed = GetTrackingReplayRequestSchema.safeParse({
        containerId: params.containerId,
        now: url.searchParams.get('now') ?? undefined,
      })
      if (!parsed.success) {
        return jsonResponse({ error: parsed.error.message }, 400)
      }

      const referenceNow = parseReplayNow(parsed.data.now)
      if (referenceNow === null) {
        return jsonResponse({ error: 'Invalid now query parameter' }, 400)
      }

      const replay = await trackingUseCases.replayContainerTracking(
        parsed.data.containerId,
        referenceNow,
      )
      return jsonResponse(
        toTrackingReplayResultResponseDto(replay),
        200,
        TrackingReplayResultResponseDtoSchema,
      )
    } catch (err) {
      console.error('GET /api/tracking/replay/:containerId error:', err)
      return mapErrorToResponse(err)
    }
  }

  async function getReplaySteps({
    params,
    request,
  }: {
    params: Record<string, string>
    request: Request
  }): Promise<Response> {
    try {
      const url = new URL(request.url)
      const query = GetTrackingReplayStepsQuerySchema.safeParse({
        limit: url.searchParams.get('limit') ?? undefined,
        cursor: url.searchParams.get('cursor') ?? undefined,
        now: url.searchParams.get('now') ?? undefined,
      })
      if (!query.success) {
        return jsonResponse({ error: query.error.message }, 400)
      }

      const parsed = GetTrackingReplayRequestSchema.safeParse({
        containerId: params.containerId,
        now: query.data.now,
      })
      if (!parsed.success) {
        return jsonResponse({ error: parsed.error.message }, 400)
      }

      const referenceNow = parseReplayNow(parsed.data.now)
      if (referenceNow === null) {
        return jsonResponse({ error: 'Invalid now query parameter' }, 400)
      }

      const replay = await trackingUseCases.replayContainerTracking(
        parsed.data.containerId,
        referenceNow,
      )
      const cursor = query.data.cursor ?? 0
      const limit = query.data.limit ?? replay.totalSteps
      const steps = replay.steps.slice(cursor, cursor + limit)
      const nextCursor = cursor + steps.length < replay.totalSteps ? cursor + steps.length : null

      return jsonResponse(
        toTrackingReplayStepsResponseDto(replay, steps, nextCursor),
        200,
        TrackingReplayStepsResponseDtoSchema,
      )
    } catch (err) {
      console.error('GET /api/tracking/replay/:containerId/steps error:', err)
      return mapErrorToResponse(err)
    }
  }

  async function getReplayStepSnapshot({
    params,
    request,
  }: {
    params: Record<string, string>
    request: Request
  }): Promise<Response> {
    try {
      const url = new URL(request.url)
      const parsed = GetTrackingReplayStepSnapshotRequestSchema.safeParse({
        containerId: params.containerId,
        step: params.step,
        now: url.searchParams.get('now') ?? undefined,
      })
      if (!parsed.success) {
        return jsonResponse({ error: parsed.error.message }, 400)
      }

      const referenceNow = parseReplayNow(parsed.data.now)
      if (referenceNow === null) {
        return jsonResponse({ error: 'Invalid now query parameter' }, 400)
      }

      const replay = await trackingUseCases.replayContainerTracking(
        parsed.data.containerId,
        referenceNow,
      )
      const step = replay.steps.find((entry) => entry.stepIndex === parsed.data.step)
      if (!step) {
        return jsonResponse({ error: 'Replay step not found' }, 404)
      }

      return jsonResponse(
        toTrackingReplayStepSnapshotResponseDto(replay, step),
        200,
        TrackingReplayStepSnapshotResponseDtoSchema,
      )
    } catch (err) {
      console.error('GET /api/tracking/replay/:containerId/snapshot/:step error:', err)
      return mapErrorToResponse(err)
    }
  }

  return { getReplay, getReplaySteps, getReplayStepSnapshot }
}

// ---------------------------------------------------------------------------
// Aggregated controllers
// ---------------------------------------------------------------------------

export type AlertsController = ReturnType<typeof createAlertsController>
export type SnapshotsController = ReturnType<typeof createSnapshotsController>
export type ReplayController = ReturnType<typeof createReplayController>

export type TrackingControllers = {
  readonly alerts: AlertsController
  readonly snapshots: SnapshotsController
  readonly replay: ReplayController
}

export function createTrackingControllers(deps: TrackingControllersDeps): TrackingControllers {
  return {
    alerts: createAlertsController(deps.trackingUseCases),
    snapshots: createSnapshotsController(deps.trackingUseCases),
    replay: createReplayController(deps.trackingUseCases),
  }
}
