import {
  type AgentControlCommandResultSchema,
  AgentControlLogChannelSchema,
  type AgentControlLogsResponseSchema,
  type AgentControlPathsSchema,
  type AgentOperationalSnapshotSchema,
  type AgentReleaseInventorySchema,
} from '@tools/agent/control-core/contracts'
import { z } from 'zod/v4'

export const agentControlIpcChannels = {
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
  activateRelease: 'agent-control/activate-release',
  rollbackRelease: 'agent-control/rollback-release',
  executeLocalReset: 'agent-control/execute-local-reset',
} as const

export const AgentControlLogsQuerySchema = z.object({
  channel: AgentControlLogChannelSchema.default('all'),
  tail: z.number().int().min(1).max(2000).default(200),
})

export const AgentControlChannelInputSchema = z.object({
  channel: z.string().trim().min(1).nullable(),
})

export const AgentControlBlockedVersionsInputSchema = z.object({
  versions: z.array(z.string().trim().min(1)),
})

export const AgentControlConfigPatchInputSchema = z.object({
  patch: z.record(z.string(), z.string()),
})

export const AgentControlReleaseVersionInputSchema = z.object({
  version: z.string().trim().min(1),
})

export type AgentControlRendererApi = {
  readonly getSnapshot: () => Promise<z.infer<typeof AgentOperationalSnapshotSchema>>
  readonly getLogs: (
    query?: z.input<typeof AgentControlLogsQuerySchema>,
  ) => Promise<z.infer<typeof AgentControlLogsResponseSchema>>
  readonly getReleaseInventory: () => Promise<z.infer<typeof AgentReleaseInventorySchema>>
  readonly getPaths: () => Promise<z.infer<typeof AgentControlPathsSchema>>
  readonly startAgent: () => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly stopAgent: () => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly restartAgent: () => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly pauseUpdates: () => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly resumeUpdates: () => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly changeChannel: (
    input: z.input<typeof AgentControlChannelInputSchema>,
  ) => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly setBlockedVersions: (
    input: z.input<typeof AgentControlBlockedVersionsInputSchema>,
  ) => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly updateConfig: (
    input: z.input<typeof AgentControlConfigPatchInputSchema>,
  ) => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly activateRelease: (
    input: z.input<typeof AgentControlReleaseVersionInputSchema>,
  ) => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly rollbackRelease: () => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly executeLocalReset: () => Promise<z.infer<typeof AgentControlCommandResultSchema>>
}
