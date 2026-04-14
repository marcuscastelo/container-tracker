import { AgentControlLogChannelSchema, } from '@agent/control-core/contracts';
import { z } from 'zod/v4';
export const agentControlIpcChannels = {
    getBackendState: 'agent-control/get-backend-state',
    getSnapshot: 'agent-control/get-snapshot',
    getLogs: 'agent-control/get-logs',
    getReleaseInventory: 'agent-control/get-release-inventory',
    getPaths: 'agent-control/get-paths',
    startAgent: 'agent-control/start-agent',
    stopAgent: 'agent-control/stop-agent',
    restartAgent: 'agent-control/restart-agent',
    pauseUpdates: 'agent-control/pause-updates',
    resumeUpdates: 'agent-control/resume-updates',
    changeChannel: 'agent-control/change-channel',
    setBlockedVersions: 'agent-control/set-blocked-versions',
    updateConfig: 'agent-control/update-config',
    setBackendUrl: 'agent-control/set-backend-url',
    activateRelease: 'agent-control/activate-release',
    rollbackRelease: 'agent-control/rollback-release',
    executeLocalReset: 'agent-control/execute-local-reset',
};
export const AgentControlLogsQuerySchema = z.object({
    channel: AgentControlLogChannelSchema.default('all'),
    tail: z.number().int().min(1).max(2000).default(200),
    interactive: z.boolean().default(true),
});
export const AgentControlChannelInputSchema = z.object({
    channel: z.string().trim().min(1).nullable(),
});
export const AgentControlBlockedVersionsInputSchema = z.object({
    versions: z.array(z.string().trim().min(1)),
});
export const AgentControlConfigPatchInputSchema = z.object({
    patch: z.record(z.string(), z.string()),
});
export const AgentControlBackendUrlInputSchema = z.object({
    backendUrl: z.string().trim().url(),
});
export const AgentControlReleaseVersionInputSchema = z.object({
    version: z.string().trim().min(1),
});
