import { bootstrapAgentControlControllers } from '~/modules/agent/interface/http/agent-control.controllers.bootstrap'

export const runtime = 'nodejs'

const agentControlControllers = bootstrapAgentControlControllers()

export const POST = agentControlControllers.acknowledgeControlCommand
