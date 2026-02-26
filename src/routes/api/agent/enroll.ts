/**
 * Agent enrollment API route — thin adapter to the tracking enrollment controller.
 *
 * POST /api/agent/enroll
 */

import { bootstrapAgentEnrollControllers } from '~/modules/tracking/interface/http/agent-enroll.controllers.bootstrap'

export const runtime = 'nodejs'

const agentEnrollControllers = bootstrapAgentEnrollControllers()

export const POST = agentEnrollControllers.enroll
