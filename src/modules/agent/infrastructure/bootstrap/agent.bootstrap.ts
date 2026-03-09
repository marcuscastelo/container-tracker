import type { AgentMonitoringRepository } from '~/modules/agent/application/agent-monitoring.repository'
import {
  type AgentMonitoringUseCases,
  createAgentMonitoringUseCases,
} from '~/modules/agent/application/agent-monitoring.usecases'
import { supabaseAgentMonitoringRepository } from '~/modules/agent/infrastructure/persistence/supabaseAgentMonitoringRepository'
import { serverEnv } from '~/shared/config/server-env'

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
  const agentMonitoringUseCases = createAgentMonitoringUseCases({
    repository,
    updateManifestConfig: {
      version: serverEnv.AGENT_UPDATE_MANIFEST_VERSION ?? undefined,
      downloadUrl: serverEnv.AGENT_UPDATE_MANIFEST_DOWNLOAD_URL ?? undefined,
      checksum: serverEnv.AGENT_UPDATE_MANIFEST_CHECKSUM ?? undefined,
      channel: serverEnv.AGENT_UPDATE_MANIFEST_CHANNEL,
    },
  })

  return {
    agentMonitoringUseCases,
  }
}
