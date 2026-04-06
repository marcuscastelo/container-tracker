import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  readCurrentControlRuntimeConfig,
  syncAgentControlState,
} from '@tools/agent/control-core/agent-control-core'
import {
  type AgentControlBackendState,
  AgentControlBackendStateSchema,
  AgentControlLogChannelSchema,
  type AgentControlLogsResponse,
  AgentControlLogsResponseSchema,
  type AgentControlPublicState,
} from '@tools/agent/control-core/contracts'
import { readAgentControlBackendState } from '@tools/agent/control-core/local-control-service'
import {
  buildAgentControlPaths,
  buildAgentReleaseInventory,
  writeAgentControlPublicState,
} from '@tools/agent/control-core/public-control-state'
import type { AgentPathLayout } from '@tools/agent/runtime-paths'
import type { z } from 'zod/v4'

const LOG_FILE_BY_CHANNEL = {
  stdout: 'agent.out.log',
  stderr: 'agent.err.log',
  supervisor: 'supervisor.log',
  updater: 'updater.log',
} as const

type ManagedLogChannel = Exclude<keyof typeof LOG_FILE_BY_CHANNEL, 'all'>

function writeFileAtomic(filePath: string, content: string): void {
  const parentDir = path.dirname(filePath)
  fs.mkdirSync(parentDir, { recursive: true })

  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(tempPath, content, 'utf8')
  fs.renameSync(tempPath, filePath)
}

function readJsonFile<T>(command: {
  readonly filePath: string
  readonly parse: (value: unknown) => T
}): T | null {
  if (!fs.existsSync(command.filePath)) {
    return null
  }

  try {
    const raw = fs.readFileSync(command.filePath, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    return command.parse(parsed)
  } catch {
    return null
  }
}

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
    parsedChannel === 'all' ? ['stdout', 'stderr', 'supervisor', 'updater'] : [parsedChannel]

  return AgentControlLogsResponseSchema.parse({
    lines: channels.flatMap((channel) => {
      const channelLines = logs.lines.filter((line) => line.channel === channel)
      const startIndex = Math.max(0, channelLines.length - tail)
      return channelLines.slice(startIndex)
    }),
  })
}

export function readAgentControlPublicBackendState(
  filePath: string,
): AgentControlBackendState | null {
  return readJsonFile({
    filePath,
    parse: (value) => AgentControlBackendStateSchema.parse(value),
  })
}

export function writeAgentControlPublicBackendState(command: {
  readonly filePath: string
  readonly state: AgentControlBackendState
}): AgentControlBackendState {
  const state = AgentControlBackendStateSchema.parse(command.state)
  writeFileAtomic(command.filePath, `${JSON.stringify(state, null, 2)}\n`)
  fs.chmodSync(command.filePath, 0o644)
  return state
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
    fs.rmSync(command.filePath, { force: true })
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
  return readJsonFile({
    filePath,
    parse: (value) => AgentControlLogsResponseSchema.parse(value),
  })
}

export function writeAgentControlPublicLogs(command: {
  readonly filePath: string
  readonly logs: AgentControlLogsResponse
}): AgentControlLogsResponse {
  const logs = AgentControlLogsResponseSchema.parse(command.logs)
  writeFileAtomic(command.filePath, `${JSON.stringify(logs, null, 2)}\n`)
  fs.chmodSync(command.filePath, 0o644)
  return logs
}

export function refreshAgentControlPublicLogs(command: {
  readonly filePath: string
  readonly layout: AgentPathLayout
  readonly tail?: number
}): AgentControlLogsResponse {
  const tail = Math.max(1, Math.min(command.tail ?? 2000, 2000))
  const logs = AgentControlLogsResponseSchema.parse({
    lines: (['stdout', 'stderr', 'supervisor', 'updater'] as const).flatMap((channel) =>
      readLogLines(path.join(command.layout.logsDir, LOG_FILE_BY_CHANNEL[channel]), channel, tail),
    ),
  })

  return writeAgentControlPublicLogs({
    filePath: command.filePath,
    logs,
  })
}
