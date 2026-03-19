/**
 * Tracking time-travel API route — thin adapter to the tracking time-travel controller.
 *
 * GET /api/tracking/containers/:containerId/time-travel
 */

import { bootstrapTrackingControllers } from '~/modules/tracking/interface/http/tracking.controllers.bootstrap'

export const runtime = 'nodejs'

const { timeTravel: timeTravelController } = bootstrapTrackingControllers()

export const GET = timeTravelController.getTimeTravel
