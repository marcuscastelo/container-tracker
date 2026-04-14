import { ensureAgentPathLayout, resolveAgentPathLayout, } from '@agent/runtime-paths';
export function createAgentRuntimeBootstrap() {
    const layout = resolveAgentPathLayout();
    ensureAgentPathLayout(layout);
    return { layout };
}
