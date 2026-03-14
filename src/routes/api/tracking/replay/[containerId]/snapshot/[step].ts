/**
 * Tracking replay step snapshot API route — thin adapter to the tracking replay controller.
 *
 * GET /api/tracking/replay/:containerId/snapshot/:step
 */

import { bootstrapTrackingControllers } from '~/modules/tracking/interface/http/tracking.controllers.bootstrap'

export const runtime = 'nodejs'

const { replay: replayController } = bootstrapTrackingControllers()

export const GET = replayController.getReplayStepSnapshot
