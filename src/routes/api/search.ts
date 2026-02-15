/**
 * Search API route — thin adapter to the search controller.
 *
 * GET /api/search?q=<query>&limit=<number> — Global search
 *
 * All logic lives in the controller; the route only delegates.
 */

import { searchControllers } from '~/modules/search/interface/http/search.controllers.bootstrap'

export const GET = searchControllers.search
