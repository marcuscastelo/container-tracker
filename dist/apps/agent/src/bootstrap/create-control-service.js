import { createAgentRuntimeBootstrap } from '@agent/bootstrap/create-agent-runtime';
import { createControlService } from '@agent/control/control.service';
export function createBootstrapControlService() {
    const { layout } = createAgentRuntimeBootstrap();
    return createControlService({ layout });
}
