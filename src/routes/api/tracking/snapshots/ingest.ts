/**
 * Snapshot ingest API route — thin adapter to the tracking agent-sync controller.
 *
 * POST /api/tracking/snapshots/ingest
 */

import { bootstrapAgentSyncControllers } from '~/modules/tracking/interface/http/agent-sync.controllers.bootstrap'

const agentSyncControllers = bootstrapAgentSyncControllers()

export const POST = agentSyncControllers.ingestSnapshot
