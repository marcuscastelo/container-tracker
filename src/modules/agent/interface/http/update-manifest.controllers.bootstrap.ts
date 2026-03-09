import { bootstrapAgentMonitoringModule } from '~/modules/agent/infrastructure/bootstrap/agent.bootstrap'
import {
  createUpdateManifestControllers,
  type UpdateManifestControllers,
} from '~/modules/agent/interface/http/update-manifest.controllers'

type UpdateManifestControllersBootstrapOverrides = {
  readonly controllers?: UpdateManifestControllers
}

export function bootstrapUpdateManifestControllers(
  overrides: UpdateManifestControllersBootstrapOverrides = {},
): UpdateManifestControllers {
  if (overrides.controllers) {
    return overrides.controllers
  }

  const { agentMonitoringUseCases, updateManifestService } = bootstrapAgentMonitoringModule()

  return createUpdateManifestControllers({
    authenticateAgentToken: agentMonitoringUseCases,
    updateManifestService,
  })
}
