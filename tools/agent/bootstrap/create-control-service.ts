import { createControlService } from '@tools/agent/control/control.service'
import { createAgentRuntimeBootstrap } from '@tools/agent/bootstrap/create-agent-runtime'

export function createBootstrapControlService() {
  const { layout } = createAgentRuntimeBootstrap()
  return createControlService({ layout })
}
