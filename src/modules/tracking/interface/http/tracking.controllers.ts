/**
 * Tracking controllers — HTTP boundary for tracking operations.
 *
 * Pattern: routes → controller → usecase (per architecture guide §10)
 */

import type { TrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import {
  toAlertResponseDto,
  toObservationResponseDto,
  toSnapshotResponseDto,
  toTrackingReplayDebugResponseDto,
  toTrackingSeriesHistoryResponseDto,
  toTrackingTimeTravelResponseDto,
} from '~/modules/tracking/interface/http/tracking.http.mappers'
import {
  AlertActionBodySchema,
  GetLatestSnapshotRequestSchema,
  GetObservationInspectorRequestSchema,
  GetSnapshotsForContainerRequestSchema,
  GetTimelineItemSeriesHistoryRequestSchema,
  GetTrackingReplayDebugRequestSchema,
  GetTrackingTimeTravelRequestSchema,
  ListAlertsQuerySchema,
  ObservationInspectorResponseDtoSchema,
  TimelineSeriesHistoryResponseDtoSchema,
  TrackingReplayDebugResponseDtoSchema,
  TrackingTimeTravelResponseDtoSchema,
} from '~/modules/tracking/interface/http/tracking.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'
import { systemClock } from '~/shared/time/clock'
import type { Instant } from '~/shared/time/instant'
import { parseInstantFromIso } from '~/shared/time/parsing'

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

function parseReferenceNow(rawNow: string | undefined): Instant | null {
  if (rawNow === undefined) return systemClock.now()
  return parseInstantFromIso(rawNow)
}

function createTimeTravelController(trackingUseCases: TrackingUseCases) {
  async function getTimeTravel({
    params,
    request,
  }: {
    params: Record<string, string>
    request: Request
  }): Promise<Response> {
    try {
      const url = new URL(request.url)
      const parsed = GetTrackingTimeTravelRequestSchema.safeParse({
        containerId: params.containerId,
        now: url.searchParams.get('now') ?? undefined,
      })
      if (!parsed.success) {
        return jsonResponse({ error: parsed.error.message }, 400)
      }

      const referenceNow = parseReferenceNow(parsed.data.now)
      if (referenceNow === null) {
        return jsonResponse({ error: 'Invalid now query parameter' }, 400)
      }

      const replay = await trackingUseCases.getTrackingTimeTravel({
        containerId: parsed.data.containerId,
        now: referenceNow,
      })

      return jsonResponse(
        toTrackingTimeTravelResponseDto(replay),
        200,
        TrackingTimeTravelResponseDtoSchema,
      )
    } catch (err) {
      console.error('GET /api/tracking/containers/:containerId/time-travel error:', err)
      return mapErrorToResponse(err)
    }
  }

  async function getReplayDebug({
    params,
    request,
  }: {
    params: Record<string, string>
    request: Request
  }): Promise<Response> {
    try {
      const url = new URL(request.url)
      const parsed = GetTrackingReplayDebugRequestSchema.safeParse({
        containerId: params.containerId,
        snapshotId: params.snapshotId,
        now: url.searchParams.get('now') ?? undefined,
      })
      if (!parsed.success) {
        return jsonResponse({ error: parsed.error.message }, 400)
      }

      const referenceNow = parseReferenceNow(parsed.data.now)
      if (referenceNow === null) {
        return jsonResponse({ error: 'Invalid now query parameter' }, 400)
      }

      const replay = await trackingUseCases.getTrackingReplayDebug({
        containerId: parsed.data.containerId,
        snapshotId: parsed.data.snapshotId,
        now: referenceNow,
      })

      return jsonResponse(
        toTrackingReplayDebugResponseDto(replay),
        200,
        TrackingReplayDebugResponseDtoSchema,
      )
    } catch (err) {
      console.error(
        'GET /api/tracking/containers/:containerId/time-travel/:snapshotId/debug error:',
        err,
      )
      return mapErrorToResponse(err)
    }
  }

  return { getTimeTravel, getReplayDebug }
}

function createDetailDrilldownController(trackingUseCases: TrackingUseCases) {
  async function getTimelineItemSeriesHistory({
    params,
    request,
  }: {
    params: Record<string, string>
    request: Request
  }): Promise<Response> {
    try {
      const url = new URL(request.url)
      const parsed = GetTimelineItemSeriesHistoryRequestSchema.safeParse({
        containerId: params.containerId,
        timelineItemId: params.timelineItemId,
      })
      if (!parsed.success) {
        return jsonResponse({ error: parsed.error.message }, 400)
      }

      const referenceNow = parseReferenceNow(url.searchParams.get('now') ?? undefined)
      if (referenceNow === null) {
        return jsonResponse({ error: 'Invalid now query parameter' }, 400)
      }

      const seriesHistory = await trackingUseCases.findTimelineItemSeriesHistory({
        containerId: parsed.data.containerId,
        timelineItemId: parsed.data.timelineItemId,
        now: referenceNow,
      })
      if (seriesHistory === null) {
        return jsonResponse({ error: 'Timeline item history not found' }, 404)
      }

      return jsonResponse(
        toTrackingSeriesHistoryResponseDto(seriesHistory),
        200,
        TimelineSeriesHistoryResponseDtoSchema,
      )
    } catch (err) {
      console.error(
        'GET /api/tracking/containers/:containerId/timeline-items/:timelineItemId/history error:',
        err,
      )
      return mapErrorToResponse(err)
    }
  }

  async function getObservationInspector({
    params,
  }: {
    params: Record<string, string>
  }): Promise<Response> {
    try {
      const parsed = GetObservationInspectorRequestSchema.safeParse({
        containerId: params.containerId,
        observationId: params.observationId,
      })
      if (!parsed.success) {
        return jsonResponse({ error: parsed.error.message }, 400)
      }

      const observation = await trackingUseCases.findObservationInspectorProjection({
        containerId: parsed.data.containerId,
        observationId: parsed.data.observationId,
      })
      if (observation === null) {
        return jsonResponse({ error: 'Observation not found' }, 404)
      }

      return jsonResponse(
        toObservationResponseDto(observation),
        200,
        ObservationInspectorResponseDtoSchema,
      )
    } catch (err) {
      console.error(
        'GET /api/tracking/containers/:containerId/observations/:observationId error:',
        err,
      )
      return mapErrorToResponse(err)
    }
  }

  return { getTimelineItemSeriesHistory, getObservationInspector }
}

// ---------------------------------------------------------------------------
// Aggregated controllers
// ---------------------------------------------------------------------------

export type AlertsController = ReturnType<typeof createAlertsController>
export type SnapshotsController = ReturnType<typeof createSnapshotsController>
export type TimeTravelController = ReturnType<typeof createTimeTravelController>
export type DetailDrilldownController = ReturnType<typeof createDetailDrilldownController>

export type TrackingControllers = {
  readonly alerts: AlertsController
  readonly snapshots: SnapshotsController
  readonly timeTravel: TimeTravelController
  readonly detail: DetailDrilldownController
}

export function createTrackingControllers(deps: TrackingControllersDeps): TrackingControllers {
  return {
    alerts: createAlertsController(deps.trackingUseCases),
    snapshots: createSnapshotsController(deps.trackingUseCases),
    timeTravel: createTimeTravelController(deps.trackingUseCases),
    detail: createDetailDrilldownController(deps.trackingUseCases),
  }
}
