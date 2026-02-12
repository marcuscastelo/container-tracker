/**
 * Latest snapshot API route — thin adapter to the tracking snapshots controller.
 *
 * GET /api/tracking/containers/:containerId/snapshots/latest — Get latest snapshot for a container
 *
 * All logic lives in the controller; the route only delegates.
 */

import { bootstrapTrackingControllers } from '~/modules/tracking/interface/http/tracking.controllers.bootstrap'

const { snapshots: snapshotsController } = bootstrapTrackingControllers()

export const GET = snapshotsController.getLatestSnapshot
