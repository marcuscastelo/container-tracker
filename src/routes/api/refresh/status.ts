/**
 * Refresh status API route - thin adapter to tracking refresh controllers.
 *
 * GET /api/refresh/status
 */

import { bootstrapRefreshControllers } from '~/modules/tracking/interface/http/refresh.controllers.bootstrap'

export const runtime = 'nodejs'

const refreshControllers = bootstrapRefreshControllers()

export const GET = refreshControllers.status
