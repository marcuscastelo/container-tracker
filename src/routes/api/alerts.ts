/**
 * Alerts API route — thin adapter to the tracking alerts controller.
 *
 * GET /api/alerts?container_id=<uuid> — List active alerts for a container
 * PATCH /api/alerts — Acknowledge or dismiss an alert
 *
 * All logic lives in the controller; the route only delegates.
 */

import { alertsController } from '~/modules/tracking/interface/http/tracking-alerts.controller.bootstrap'

export const GET = alertsController.listAlerts
export const PATCH = alertsController.handleAlertAction
