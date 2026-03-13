/**
 * Tracking replay steps API route — thin adapter to the tracking replay controller.
 *
 * GET /api/tracking/replay/:containerId/steps
 */

import { bootstrapTrackingControllers } from '~/modules/tracking/interface/http/tracking.controllers.bootstrap'

export const runtime = 'nodejs'

const { replay: replayController } = bootstrapTrackingControllers()

export const GET = replayController.getReplaySteps
