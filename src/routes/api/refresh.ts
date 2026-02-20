/**
 * Refresh API route - thin adapter to tracking refresh controllers.
 *
 * POST /api/refresh
 * GET  /api/refresh (health)
 */

import { bootstrapRefreshControllers } from '~/modules/tracking/interface/http/refresh.controllers.bootstrap'

const refreshControllers = bootstrapRefreshControllers()

export const POST = refreshControllers.refresh
export const GET = refreshControllers.health
