import { createAgentRuntimeBootstrap } from '@tools/agent/bootstrap/create-agent-runtime'
import { createControlService } from '@tools/agent/control/control.service'

export function createBootstrapControlService() {
  const { layout } = createAgentRuntimeBootstrap()
  return createControlService({ layout })
}
