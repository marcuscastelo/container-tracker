/**
 * Tracking controllers — HTTP boundary for tracking operations.
 *
 * Pattern: routes → controller → usecase (per architecture guide §10)
 */

import type { TrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import {
  toAlertResponseDto,
  toSnapshotResponseDto,
} from '~/modules/tracking/interface/http/tracking.http.mappers'
import {
  AlertActionBodySchema,
  GetLatestSnapshotRequestSchema,
  GetSnapshotsForContainerRequestSchema,
  ListAlertsQuerySchema,
} from '~/modules/tracking/interface/http/tracking.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'

// ---------------------------------------------------------------------------
// Dependency types
// ---------------------------------------------------------------------------

export type TrackingControllersDeps = {
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

  // PATCH /api/alerts — acknowledge or dismiss
  async function handleAlertAction({ request }: { request: Request }): Promise<Response> {
    try {
      const raw: unknown = await request.json().catch(() => ({}))
      const parsed = AlertActionBodySchema.safeParse(raw)
      if (!parsed.success) {
        return jsonResponse({ error: `Invalid request: ${parsed.error.message}` }, 400)
      }

      const { alert_id, action } = parsed.data

      if (action === 'acknowledge') {
        await trackingUseCases.acknowledgeAlert(alert_id)
      } else {
        await trackingUseCases.dismissAlert(alert_id)
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

// ---------------------------------------------------------------------------
// Aggregated controllers
// ---------------------------------------------------------------------------

export type AlertsController = ReturnType<typeof createAlertsController>
export type SnapshotsController = ReturnType<typeof createSnapshotsController>

export type TrackingControllers = {
  readonly alerts: AlertsController
  readonly snapshots: SnapshotsController
}

export function createTrackingControllers(deps: TrackingControllersDeps): TrackingControllers {
  return {
    alerts: createAlertsController(deps.trackingUseCases),
    snapshots: createSnapshotsController(deps.trackingUseCases),
  }
}
