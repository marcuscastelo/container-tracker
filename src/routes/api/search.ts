/**
 * Search API route — thin adapter to the search controller.
 *
 * GET /api/search?q=<query> — Ctrl+K global search
 *
 * All logic lives in the controller; the route only delegates.
 */

import { searchControllers } from '~/shared/api/search.controllers.bootstrap'

export const GET = searchControllers.search
