import { bootstrapAgentMonitoringModule } from '~/modules/agent/infrastructure/bootstrap/agent.bootstrap'
import {
  type AgentMonitoringControllers,
  createAgentMonitoringControllers,
} from '~/modules/agent/interface/http/agent-monitoring.controllers'
import { serverEnv } from '~/shared/config/server-env'

type AgentMonitoringControllersBootstrapOverrides = {
  readonly controllers?: AgentMonitoringControllers
}

export function bootstrapAgentMonitoringControllers(
  overrides: AgentMonitoringControllersBootstrapOverrides = {},
): AgentMonitoringControllers {
  if (overrides.controllers) {
    return overrides.controllers
  }

  const { agentMonitoringUseCases } = bootstrapAgentMonitoringModule()

  return createAgentMonitoringControllers({
    defaultTenantId: serverEnv.SYNC_DEFAULT_TENANT_ID,
    agentMonitoringUseCases,
  })
}
