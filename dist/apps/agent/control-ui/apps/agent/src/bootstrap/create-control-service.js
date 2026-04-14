import { createAgentRuntimeBootstrap } from './create-agent-runtime.js';
import { createControlService } from '../control/control.service.js';
export function createBootstrapControlService() {
    const { layout } = createAgentRuntimeBootstrap();
    return createControlService({ layout });
}
