import { createRequire } from 'node:module'
import {
  AgentControlCommandResultSchema,
  AgentControlLogsResponseSchema,
  AgentControlPathsSchema,
  AgentOperationalSnapshotSchema,
  AgentReleaseInventorySchema,
} from '@tools/agent/control-core/contracts'
import {
  AgentControlBlockedVersionsInputSchema,
  AgentControlChannelInputSchema,
  AgentControlConfigPatchInputSchema,
  AgentControlLogsQuerySchema,
  AgentControlReleaseVersionInputSchema,
  type AgentControlRendererApi,
  agentControlIpcChannels,
} from '@tools/agent-control-ui/ipc'
import type { z } from 'zod/v4'

const require = createRequire(import.meta.url)
const electron: typeof import('electron') = require('electron')
const { contextBridge, ipcRenderer } = electron

async function invokeAndParse<T extends z.ZodType>(
  channel: string,
  schema: T,
  ...args: readonly unknown[]
): Promise<z.infer<T>> {
  const result = await ipcRenderer.invoke(channel, ...args)
  return schema.parse(result)
}

const api: AgentControlRendererApi = {
  getSnapshot() {
    return invokeAndParse(agentControlIpcChannels.getSnapshot, AgentOperationalSnapshotSchema)
  },
  getLogs(query) {
    const parsed = AgentControlLogsQuerySchema.parse(query ?? {})
    return invokeAndParse(agentControlIpcChannels.getLogs, AgentControlLogsResponseSchema, parsed)
  },
  getReleaseInventory() {
    return invokeAndParse(agentControlIpcChannels.getReleaseInventory, AgentReleaseInventorySchema)
  },
  getPaths() {
    return invokeAndParse(agentControlIpcChannels.getPaths, AgentControlPathsSchema)
  },
  startAgent() {
    return invokeAndParse(agentControlIpcChannels.startAgent, AgentControlCommandResultSchema)
  },
  stopAgent() {
    return invokeAndParse(agentControlIpcChannels.stopAgent, AgentControlCommandResultSchema)
  },
  restartAgent() {
    return invokeAndParse(agentControlIpcChannels.restartAgent, AgentControlCommandResultSchema)
  },
  pauseUpdates() {
    return invokeAndParse(agentControlIpcChannels.pauseUpdates, AgentControlCommandResultSchema)
  },
  resumeUpdates() {
    return invokeAndParse(agentControlIpcChannels.resumeUpdates, AgentControlCommandResultSchema)
  },
  changeChannel(input) {
    const parsed = AgentControlChannelInputSchema.parse(input)
    return invokeAndParse(
      agentControlIpcChannels.changeChannel,
      AgentControlCommandResultSchema,
      parsed,
    )
  },
  setBlockedVersions(input) {
    const parsed = AgentControlBlockedVersionsInputSchema.parse(input)
    return invokeAndParse(
      agentControlIpcChannels.setBlockedVersions,
      AgentControlCommandResultSchema,
      parsed,
    )
  },
  updateConfig(input) {
    const parsed = AgentControlConfigPatchInputSchema.parse(input)
    return invokeAndParse(
      agentControlIpcChannels.updateConfig,
      AgentControlCommandResultSchema,
      parsed,
    )
  },
  activateRelease(input) {
    const parsed = AgentControlReleaseVersionInputSchema.parse(input)
    return invokeAndParse(
      agentControlIpcChannels.activateRelease,
      AgentControlCommandResultSchema,
      parsed,
    )
  },
  rollbackRelease() {
    return invokeAndParse(agentControlIpcChannels.rollbackRelease, AgentControlCommandResultSchema)
  },
  executeLocalReset() {
    return invokeAndParse(
      agentControlIpcChannels.executeLocalReset,
      AgentControlCommandResultSchema,
    )
  },
}

contextBridge.exposeInMainWorld('agentControl', api)
