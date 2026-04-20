import { bootstrapAgentMonitoringControllers } from '~/modules/agent/interface/http/agent-monitoring.controllers.bootstrap'

export const runtime = 'nodejs'

const agentMonitoringControllers = bootstrapAgentMonitoringControllers()

export const PATCH = agentMonitoringControllers.updateAgentRemotePolicy
