/**
 * Alerts controller — HTTP boundary for tracking alert operations.
 *
 * Endpoint chosen for migration: /api/alerts (GET + PATCH)
 * Reason: self-contained, no cross-module deps, clear request/response shapes,
 * exercises both read (list alerts) and write (ack/dismiss) paths.
 *
 * Pattern: routes → controller → usecase (per architecture guide §10)
 */

import type { TrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import { toAlertResponseDto } from '~/modules/tracking/interface/http/tracking-alerts.http.mappers'
import {
  AlertActionBodySchema,
  ListAlertsQuerySchema,
} from '~/modules/tracking/interface/http/tracking-alerts.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'

// ---------------------------------------------------------------------------
// Dependency types
// ---------------------------------------------------------------------------

export type TrackingUseCasesForAlerts = Pick<
  TrackingUseCases,
  'getContainerSummary' | 'acknowledgeAlert' | 'dismissAlert'
>

export type AlertsControllerDeps = {
  readonly usecases: TrackingUseCasesForAlerts
}

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createAlertsController(deps: AlertsControllerDeps) {
  const { usecases: trackingUseCases } = deps

  // -----------------------------------------------------------------------
  // GET /api/alerts?container_id=<uuid>
  // -----------------------------------------------------------------------
  async function listAlerts({ request }: { request: Request }): Promise<Response> {
    try {
      const url = new URL(request.url)
      const rawContainerId = url.searchParams.get('container_id')

      const queryResult = ListAlertsQuerySchema.safeParse({ container_id: rawContainerId })
      if (!queryResult.success) {
        return jsonResponse({ error: queryResult.error.message }, 400)
      }

      const containerId = queryResult.data.container_id

      // getContainerSummary needs containerNumber, but for alerts listing
      // we only care about the alerts portion. Pass empty string as containerNumber
      // since alerts are fetched by containerId only.
      const summary = await trackingUseCases.getContainerSummary(containerId, '')

      const response = summary.alerts.map(toAlertResponseDto)
      return jsonResponse(response, 200)
    } catch (err) {
      console.error('GET /api/alerts error:', err)
      return mapErrorToResponse(err)
    }
  }

  // -----------------------------------------------------------------------
  // PATCH /api/alerts — acknowledge or dismiss
  // -----------------------------------------------------------------------
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

  return {
    listAlerts,
    handleAlertAction,
  }
}

export type AlertsController = ReturnType<typeof createAlertsController>
