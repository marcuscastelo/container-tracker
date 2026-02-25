/**
 * Agent targets API route — thin adapter to the tracking agent-sync controller.
 *
 * GET /api/agent/targets?tenant_id=<uuid>&limit=<n>
 */

import { bootstrapAgentSyncControllers } from '~/modules/tracking/interface/http/agent-sync.controllers.bootstrap'

export const runtime = 'nodejs'

const agentSyncControllers = bootstrapAgentSyncControllers()

export const GET = agentSyncControllers.getTargets
