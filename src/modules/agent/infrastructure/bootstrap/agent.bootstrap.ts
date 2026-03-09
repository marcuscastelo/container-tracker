import type { AgentMonitoringRepository } from '~/modules/agent/application/agent-monitoring.repository'
import {
  type AgentMonitoringUseCases,
  createAgentMonitoringUseCases,
} from '~/modules/agent/application/agent-monitoring.usecases'
import { supabaseAgentMonitoringRepository } from '~/modules/agent/infrastructure/persistence/supabaseAgentMonitoringRepository'

type AgentMonitoringBootstrapOverrides = {
  readonly repository?: AgentMonitoringRepository
}

type AgentMonitoringModule = {
  readonly agentMonitoringUseCases: AgentMonitoringUseCases
}

export function bootstrapAgentMonitoringModule(
  overrides: AgentMonitoringBootstrapOverrides = {},
): AgentMonitoringModule {
  const repository = overrides.repository ?? supabaseAgentMonitoringRepository
  const agentMonitoringUseCases = createAgentMonitoringUseCases({ repository })

  return {
    agentMonitoringUseCases,
  }
}
