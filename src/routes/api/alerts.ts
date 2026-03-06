/**
 * Alerts API route — thin adapter to the tracking alerts controller.
 *
 * GET /api/alerts?container_id=<uuid> — List active alerts for a container
 * PATCH /api/alerts — Acknowledge or unacknowledge an alert
 *
 * All logic lives in the controller; the route only delegates.
 */

import { bootstrapTrackingControllers } from '~/modules/tracking/interface/http/tracking.controllers.bootstrap'

const { alerts: alertsController } = bootstrapTrackingControllers()

export const GET = alertsController.listAlerts
export const PATCH = alertsController.handleAlertAction
