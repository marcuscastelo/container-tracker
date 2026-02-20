/**
 * Maersk refresh API route - thin adapter to tracking refresh controllers.
 *
 * GET/POST /api/refresh-maersk/:container
 */

import { bootstrapRefreshControllers } from '~/modules/tracking/interface/http/refresh.controllers.bootstrap'

const refreshControllers = bootstrapRefreshControllers()

export const GET = refreshControllers.refreshMaersk
export const POST = refreshControllers.refreshMaersk
