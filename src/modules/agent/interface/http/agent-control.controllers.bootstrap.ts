import { bootstrapAgentMonitoringModule } from '~/modules/agent/infrastructure/bootstrap/agent.bootstrap'
import {
  type AgentControlControllers,
  createAgentControlControllers,
} from '~/modules/agent/interface/http/agent-control.controllers'

type AgentControlControllersBootstrapOverrides = {
  readonly controllers?: AgentControlControllers
}

export function bootstrapAgentControlControllers(
  overrides: AgentControlControllersBootstrapOverrides = {},
): AgentControlControllers {
  if (overrides.controllers) {
    return overrides.controllers
  }

  const { agentMonitoringUseCases } = bootstrapAgentMonitoringModule()

  return createAgentControlControllers({
    agentMonitoringUseCases,
  })
}
