import fs from 'node:fs'
import path from 'node:path'
import type { AgentPathLayout } from '@agent/config/config.contract'
import {
  readCurrentControlRuntimeConfig,
  syncAgentControlState,
} from '@agent/control-core/agent-control-core'
import {
  type AgentControlBackendState,
  AgentControlBackendStateSchema,
  AgentControlLogChannelSchema,
  type AgentControlLogsResponse,
  AgentControlLogsResponseSchema,
  type AgentControlPublicState,
} from '@agent/control-core/contracts'
import { readAgentControlBackendState } from '@agent/control-core/local-control-service'
import { sortMergedLogLinesByTimestamp } from '@agent/control-core/log-ordering'
import {
  buildAgentControlPaths,
  buildAgentReleaseInventory,
  writeAgentControlPublicState,
} from '@agent/control-core/public-control-state'
import {
  readStateJsonFile,
  removeStateFile,
  writeStateJsonFile,
} from '@agent/state/infrastructure/json-state.file-store'
import type { z } from 'zod/v4'

const LOG_FILE_BY_CHANNEL = {
  stdout: 'agent.out.log',
  stderr: 'agent.err.log',
  supervisor: 'supervisor.log',
} as const

type ManagedLogChannel = Exclude<keyof typeof LOG_FILE_BY_CHANNEL, 'all'>

function readLogLines(filePath: string, channel: ManagedLogChannel, tail: number) {
  if (!fs.existsSync(filePath)) {
    return []
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const rawLines = content.split(/\r?\n/u).filter((line) => line.length > 0)
  const startIndex = Math.max(0, rawLines.length - tail)

  return rawLines.slice(startIndex).map((message, index) => ({
    channel,
    message,
    filePath,
    lineNumber: startIndex + index + 1,
  }))
}

export function selectAgentControlPublicLogs(
  logs: AgentControlLogsResponse,
  command?: {
    readonly channel?: z.input<typeof AgentControlLogChannelSchema>
    readonly tail?: number
  },
): AgentControlLogsResponse {
  const parsedChannel = AgentControlLogChannelSchema.parse(command?.channel ?? 'all')
  const tail = Math.max(1, Math.min(command?.tail ?? 200, 2000))
  const channels: readonly ManagedLogChannel[] =
    parsedChannel === 'all' ? ['stdout', 'stderr', 'supervisor'] : [parsedChannel]

  const mergedLines = channels.flatMap((channel) => {
    const channelLines = logs.lines.filter((line) => line.channel === channel)
    const startIndex = Math.max(0, channelLines.length - tail)
    return channelLines.slice(startIndex)
  })
  const lines = parsedChannel === 'all' ? sortMergedLogLinesByTimestamp(mergedLines) : mergedLines

  return AgentControlLogsResponseSchema.parse({
    lines,
  })
}

export function readAgentControlPublicBackendState(
  filePath: string,
): AgentControlBackendState | null {
  return readStateJsonFile({
    filePath,
    schema: AgentControlBackendStateSchema,
  })
}

export function writeAgentControlPublicBackendState(command: {
  readonly filePath: string
  readonly state: AgentControlBackendState
}): AgentControlBackendState {
  return writeStateJsonFile({
    filePath: command.filePath,
    schema: AgentControlBackendStateSchema,
    value: command.state,
    mode: 0o644,
  })
}

export function refreshAgentControlPublicBackendState(command: {
  readonly filePath: string
  readonly layout: AgentPathLayout
}): AgentControlBackendState {
  return writeAgentControlPublicBackendState({
    filePath: command.filePath,
    state: readAgentControlBackendState(command.layout),
  })
}

export async function publishAgentControlPublicSnapshot(command: {
  readonly filePath: string
  readonly backendStatePath: string
  readonly layout: AgentPathLayout
  readonly forceRemoteFetch?: boolean
  readonly controlSync?: Awaited<ReturnType<typeof syncAgentControlState>>
}): Promise<AgentControlPublicState | null> {
  const baseBackendState = readAgentControlBackendState(command.layout)
  const controlSync =
    typeof command.controlSync !== 'undefined'
      ? command.controlSync
      : await (async () => {
          const currentConfig = readCurrentControlRuntimeConfig(command.layout)
          if (!currentConfig) {
            return null
          }

          return syncAgentControlState({
            layout: command.layout,
            currentConfig,
            forceRemoteFetch: command.forceRemoteFetch ?? false,
          })
        })()

  if (!controlSync) {
    removeStateFile(command.filePath)
    writeAgentControlPublicBackendState({
      filePath: command.backendStatePath,
      state: {
        ...baseBackendState,
        publicStateAvailable: false,
      },
    })
    return null
  }

  const backendState = AgentControlBackendStateSchema.parse({
    ...baseBackendState,
    publicStateAvailable: true,
  })

  const publicState = writeAgentControlPublicState({
    filePath: command.filePath,
    snapshot: controlSync.snapshot,
    releaseInventory: buildAgentReleaseInventory({
      layout: command.layout,
      releaseState: controlSync.releaseState,
    }),
    paths: buildAgentControlPaths(command.layout),
    backendState,
  })

  writeAgentControlPublicBackendState({
    filePath: command.backendStatePath,
    state: backendState,
  })

  return publicState
}

export function readAgentControlPublicLogs(filePath: string): AgentControlLogsResponse | null {
  return readStateJsonFile({
    filePath,
    schema: AgentControlLogsResponseSchema,
  })
}

export function writeAgentControlPublicLogs(command: {
  readonly filePath: string
  readonly logs: AgentControlLogsResponse
}): AgentControlLogsResponse {
  return writeStateJsonFile({
    filePath: command.filePath,
    schema: AgentControlLogsResponseSchema,
    value: command.logs,
    mode: 0o644,
  })
}

export function refreshAgentControlPublicLogs(command: {
  readonly filePath: string
  readonly layout: AgentPathLayout
  readonly tail?: number
}): AgentControlLogsResponse {
  const tail = Math.max(1, Math.min(command.tail ?? 2000, 2000))
  const logs = AgentControlLogsResponseSchema.parse({
    lines: (['stdout', 'stderr', 'supervisor'] as const).flatMap((channel) =>
      readLogLines(path.join(command.layout.logsDir, LOG_FILE_BY_CHANNEL[channel]), channel, tail),
    ),
  })

  return writeAgentControlPublicLogs({
    filePath: command.filePath,
    logs,
  })
}
