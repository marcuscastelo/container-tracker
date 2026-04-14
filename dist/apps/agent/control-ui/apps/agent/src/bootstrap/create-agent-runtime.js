import { ensureAgentPathLayout, resolveAgentPathLayout, } from '../runtime-paths.js';
export function createAgentRuntimeBootstrap() {
    const layout = resolveAgentPathLayout();
    ensureAgentPathLayout(layout);
    return { layout };
}
