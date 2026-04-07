import { execFile } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

import {
  type AgentControlBackendState,
  AgentControlBackendStateSchema,
  type AgentControlBackendUpdateResult,
  AgentControlBackendUpdateResultSchema,
  type AgentControlCommandResult,
  AgentControlCommandResultSchema,
  type AgentControlLogsResponse,
  AgentControlLogsResponseSchema,
  type AgentControlPaths,
  type AgentOperationalSnapshot,
  type AgentReleaseInventory,
} from '@tools/agent/control-core/contracts'
import {
  readAgentControlPublicBackendState,
  readAgentControlPublicLogs,
  selectAgentControlPublicLogs,
} from '@tools/agent/control-core/public-control-files'
import {
  buildAgentControlPaths,
  readAgentControlPublicState,
} from '@tools/agent/control-core/public-control-state'
import { resolveInstalledLinuxAgentPathLayout } from '@tools/agent/runtime-paths'
import type { AgentPathLayout } from '@tools/agent/runtime-paths'
import {
  AgentControlBackendUrlInputSchema,
  type AgentControlBlockedVersionsInputSchema,
  type AgentControlChannelInputSchema,
  type AgentControlConfigPatchInputSchema,
  type AgentControlLogsQuerySchema,
  type AgentControlReleaseVersionInputSchema,
} from '@tools/agent/electron/ipc'
import type { z } from 'zod/v4'

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function runCommand(
  command: string,
  args: readonly string[],
): Promise<{
  readonly stdout: string
  readonly stderr: string
}> {
  return new Promise((resolve, reject) => {
    execFile(command, [...args], { maxBuffer: 1024 * 1024 * 4 }, (error, stdout, stderr) => {
      if (error) {
        const detail = stderr.trim() || stdout.trim() || toErrorMessage(error)
        reject(new Error(detail))
        return
      }

      resolve({
        stdout,
        stderr,
      })
    })
  })
}

function readPublicState() {
  return readAgentControlPublicState(resolveInstalledLinuxPublicStatePath())
}

function readPublicBackendState() {
  return readAgentControlPublicBackendState(resolveInstalledLinuxPublicBackendStatePath())
}

function readPublicLogs() {
  return readAgentControlPublicLogs(resolveInstalledLinuxPublicLogsPath())
}

function normalizeOptionalEnv(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function resolveInstalledLinuxLayout(): AgentPathLayout {
  return resolveInstalledLinuxAgentPathLayout()
}

function resolveInstalledLinuxPublicStateDir(): string {
  return normalizeOptionalEnv(process.env.AGENT_PUBLIC_STATE_DIR) || '/run/container-tracker-agent'
}

function resolveInstalledLinuxPublicStatePath(): string {
  return path.join(resolveInstalledLinuxPublicStateDir(), 'control-ui-state.json')
}

function resolveInstalledLinuxPublicBackendStatePath(): string {
  return path.join(resolveInstalledLinuxPublicStateDir(), 'control-ui-backend-state.json')
}

function resolveInstalledLinuxPublicLogsPath(): string {
  return path.join(resolveInstalledLinuxPublicStateDir(), 'control-ui-logs.json')
}

async function runAdminCommand<T>(command: {
  readonly subcommand: string
  readonly input?: unknown
  readonly parser: { readonly parse: (value: unknown) => T }
}): Promise<T> {
  const pkexecPath = process.env.CT_AGENT_PKEXEC_PATH?.trim() || 'pkexec'
  const adminPath = process.env.CT_AGENT_ADMIN_PATH?.trim() || '/usr/bin/ct-agent-admin'
  const args =
    typeof command.input === 'undefined'
      ? [adminPath, command.subcommand]
      : [adminPath, command.subcommand, JSON.stringify(command.input)]

  const { stdout } = await runCommand(pkexecPath, args)
  const normalizedStdout = stdout.trim()
  if (normalizedStdout.length === 0) {
    throw new Error(`${command.subcommand} returned no output`)
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(normalizedStdout)
  } catch (error) {
    throw new Error(`${command.subcommand} returned invalid JSON: ${toErrorMessage(error)}`)
  }

  return command.parser.parse(parsedJson)
}

function buildInstalledLinuxDebugPaths(): AgentControlPaths {
  return buildAgentControlPaths(resolveInstalledLinuxLayout())
}

export function createInstalledLinuxControlService() {
  return {
    async getBackendState(): Promise<AgentControlBackendState> {
      const publicState = readPublicState()
      if (publicState?.backendState) {
        return publicState.backendState
      }

      const publicBackendState = readPublicBackendState()
      if (publicBackendState) {
        return publicBackendState
      }

      return AgentControlBackendStateSchema.parse({
        backendUrl: null,
        source: 'NONE',
        status: 'UNCONFIGURED',
        runtimeConfigAvailable: false,
        bootstrapConfigAvailable: false,
        installerTokenAvailable: false,
        publicStateAvailable: publicState !== null,
        warnings: [
          'Backend state has not been published by the supervisor yet. Refresh after the agent finishes booting.',
        ],
      })
    },
    async getSnapshot(): Promise<AgentOperationalSnapshot> {
      const publicState = readPublicState()
      if (publicState) {
        return publicState.snapshot
      }

      if (readPublicBackendState() || readPublicLogs()) {
        throw new Error(
          `Waiting for the supervisor to publish the canonical control snapshot at ${resolveInstalledLinuxPublicStatePath()}.`,
        )
      }

      throw new Error(
        `Agent public state unavailable at ${resolveInstalledLinuxPublicStatePath()}. Confirm the system service is running.`,
      )
    },
    async getLogs(
      query?: z.input<typeof AgentControlLogsQuerySchema>,
    ): Promise<AgentControlLogsResponse> {
      const publicLogs = readPublicLogs()
      if (!publicLogs) {
        return AgentControlLogsResponseSchema.parse({
          lines: [],
        })
      }

      const publicLogSelection =
        typeof query?.channel === 'undefined' && typeof query?.tail === 'undefined'
          ? undefined
          : {
              ...(typeof query?.channel === 'undefined' ? {} : { channel: query.channel }),
              ...(typeof query?.tail === 'undefined' ? {} : { tail: query.tail }),
            }

      return selectAgentControlPublicLogs(publicLogs, publicLogSelection)
    },
    async getReleaseInventory(): Promise<AgentReleaseInventory> {
      const publicState = readPublicState()
      if (publicState) {
        return publicState.releaseInventory
      }

      return {
        releases: [],
      }
    },
    async getPaths(): Promise<AgentControlPaths> {
      const publicState = readPublicState()
      if (publicState) {
        return publicState.paths
      }

      return buildInstalledLinuxDebugPaths()
    },
    async startAgent(): Promise<AgentControlCommandResult> {
      return runAdminCommand({
        subcommand: 'start-agent',
        parser: AgentControlCommandResultSchema,
      })
    },
    async stopAgent(): Promise<AgentControlCommandResult> {
      return runAdminCommand({
        subcommand: 'stop-agent',
        parser: AgentControlCommandResultSchema,
      })
    },
    async restartAgent(): Promise<AgentControlCommandResult> {
      return runAdminCommand({
        subcommand: 'restart-agent',
        parser: AgentControlCommandResultSchema,
      })
    },
    async pauseUpdates(): Promise<AgentControlCommandResult> {
      return runAdminCommand({
        subcommand: 'pause-updates',
        parser: AgentControlCommandResultSchema,
      })
    },
    async resumeUpdates(): Promise<AgentControlCommandResult> {
      return runAdminCommand({
        subcommand: 'resume-updates',
        parser: AgentControlCommandResultSchema,
      })
    },
    async changeChannel(
      input: z.input<typeof AgentControlChannelInputSchema>,
    ): Promise<AgentControlCommandResult> {
      return runAdminCommand({
        subcommand: 'change-channel',
        input,
        parser: AgentControlCommandResultSchema,
      })
    },
    async setBlockedVersions(
      input: z.input<typeof AgentControlBlockedVersionsInputSchema>,
    ): Promise<AgentControlCommandResult> {
      return runAdminCommand({
        subcommand: 'set-blocked-versions',
        input,
        parser: AgentControlCommandResultSchema,
      })
    },
    async updateConfig(
      input: z.input<typeof AgentControlConfigPatchInputSchema>,
    ): Promise<AgentControlCommandResult> {
      return runAdminCommand({
        subcommand: 'update-config',
        input,
        parser: AgentControlCommandResultSchema,
      })
    },
    async setBackendUrl(backendUrl: string): Promise<AgentControlBackendUpdateResult> {
      const input = AgentControlBackendUrlInputSchema.parse({ backendUrl })
      return runAdminCommand({
        subcommand: 'set-backend-url',
        input,
        parser: AgentControlBackendUpdateResultSchema,
      })
    },
    async activateRelease(
      input: z.input<typeof AgentControlReleaseVersionInputSchema>,
    ): Promise<AgentControlCommandResult> {
      return runAdminCommand({
        subcommand: 'activate-release',
        input,
        parser: AgentControlCommandResultSchema,
      })
    },
    async rollbackRelease(): Promise<AgentControlCommandResult> {
      return runAdminCommand({
        subcommand: 'rollback-release',
        parser: AgentControlCommandResultSchema,
      })
    },
    async executeLocalReset(): Promise<AgentControlCommandResult> {
      return runAdminCommand({
        subcommand: 'execute-local-reset',
        parser: AgentControlCommandResultSchema,
      })
    },
  }
}
