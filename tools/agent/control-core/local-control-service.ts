import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  type ControlRuntimeConfig,
  executeLocalReset,
  readCurrentControlRuntimeConfig,
  recordOperationalEvent,
  setLocalBlockedVersions,
  setLocalChannel,
  setLocalUpdatesPaused,
  syncAgentControlState,
  updateLocalEditableConfig,
} from '@tools/agent/control-core/agent-control-core'
import {
  AgentControlCommandResultSchema,
  AgentControlLogChannelSchema,
  AgentControlLogsResponseSchema,
  AgentControlPathsSchema,
  AgentReleaseInventorySchema,
} from '@tools/agent/control-core/contracts'
import {
  resolveReleaseEntrypoint,
  rollbackRelease as rollbackReleaseState,
} from '@tools/agent/release-manager'
import { readReleaseState, writeReleaseState } from '@tools/agent/release-state'
import type { AgentPathLayout } from '@tools/agent/runtime-paths'
import { writeSupervisorControl } from '@tools/agent/supervisor-control'
import type { z } from 'zod/v4'

const DEFAULT_SERVICE_NAME = 'container-tracker-agent'
const LOG_FILE_BY_CHANNEL = {
  stdout: 'agent.out.log',
  stderr: 'agent.err.log',
  supervisor: 'supervisor.log',
  updater: 'updater.log',
} as const

type ManagedLogChannel = Exclude<keyof typeof LOG_FILE_BY_CHANNEL, 'all'>

type AgentLocalControlAdapter = {
  readonly key: 'linux' | 'windows'
  readonly startAgent: () => Promise<void>
  readonly stopAgent: () => Promise<void>
  readonly restartAgent: () => Promise<void>
}

type AgentControlLocalService = {
  readonly getAgentOperationalSnapshot: () => ReturnType<typeof syncSnapshot>
  readonly getLogs: (command?: {
    readonly channel?: z.infer<typeof AgentControlLogChannelSchema>
    readonly tail?: number
  }) => ReturnType<typeof readLogs>
  readonly getReleaseInventory: () => ReturnType<typeof listReleaseInventory>
  readonly getPaths: () => z.infer<typeof AgentControlPathsSchema>
  readonly startAgent: () => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly stopAgent: () => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly restartAgent: () => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly pauseUpdates: () => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly resumeUpdates: () => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly changeChannel: (
    channel: string | null,
  ) => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly setBlockedVersions: (
    versions: readonly string[],
  ) => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly updateConfig: (
    patch: Record<string, string>,
  ) => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly activateRelease: (
    version: string,
  ) => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly rollbackRelease: () => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly executeLocalReset: () => Promise<z.infer<typeof AgentControlCommandResultSchema>>
}

type CreateAgentControlLocalServiceDeps = {
  readonly layout: AgentPathLayout
  readonly adapter?: AgentLocalControlAdapter
}

function runCommand(command: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = execFile(command, [...args], (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })

    child.once('error', reject)
  })
}

function createWindowsStubAdapter(): AgentLocalControlAdapter {
  async function notImplemented(): Promise<void> {
    throw new Error('Windows local control adapter is not implemented in V1')
  }

  return {
    key: 'windows',
    startAgent: notImplemented,
    stopAgent: notImplemented,
    restartAgent: notImplemented,
  }
}

function createLinuxAdapter(): AgentLocalControlAdapter {
  const serviceName = process.env.AGENT_SERVICE_NAME?.trim() || DEFAULT_SERVICE_NAME

  return {
    key: 'linux',
    startAgent() {
      return runCommand('systemctl', ['start', serviceName])
    },
    stopAgent() {
      return runCommand('systemctl', ['stop', serviceName])
    },
    restartAgent() {
      return runCommand('systemctl', ['restart', serviceName])
    },
  }
}

function resolveLocalControlAdapter(): AgentLocalControlAdapter {
  if (process.platform === 'win32') {
    return createWindowsStubAdapter()
  }

  return createLinuxAdapter()
}

function requireCurrentConfig(layout: AgentPathLayout): ControlRuntimeConfig {
  const config = readCurrentControlRuntimeConfig(layout)
  if (!config) {
    throw new Error(`Agent runtime config is unavailable at ${layout.configPath}`)
  }

  return config
}

async function syncSnapshot(layout: AgentPathLayout) {
  return syncAgentControlState({
    layout,
    currentConfig: requireCurrentConfig(layout),
  })
}

function listReleaseInventory(layout: AgentPathLayout) {
  const currentConfig = requireCurrentConfig(layout)
  const state = readReleaseState(layout.releaseStatePath, currentConfig.AGENT_ID)
  const entries = fs.existsSync(layout.releasesDir)
    ? fs
        .readdirSync(layout.releasesDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : []

  const releases = [...entries]
    .sort((left, right) =>
      right.localeCompare(left, undefined, { numeric: true, sensitivity: 'base' }),
    )
    .map((version) => {
      const releaseDir = path.join(layout.releasesDir, version)
      return {
        version,
        isCurrent: state.current_version === version,
        isPrevious: state.previous_version === version,
        isTarget: state.target_version === version,
        entrypointPath: resolveReleaseEntrypoint(releaseDir),
      }
    })

  return AgentReleaseInventorySchema.parse({
    releases,
  })
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

function readLogs(
  layout: AgentPathLayout,
  command?: {
    readonly channel?: z.infer<typeof AgentControlLogChannelSchema>
    readonly tail?: number
  },
) {
  const parsedChannel = AgentControlLogChannelSchema.parse(command?.channel ?? 'all')
  const tail = Math.max(1, Math.min(command?.tail ?? 200, 2000))
  const channels: readonly ManagedLogChannel[] =
    parsedChannel === 'all' ? ['stdout', 'stderr', 'supervisor', 'updater'] : [parsedChannel]

  const lines = channels.flatMap((channel) =>
    readLogLines(path.join(layout.logsDir, LOG_FILE_BY_CHANNEL[channel]), channel, tail),
  )

  return AgentControlLogsResponseSchema.parse({
    lines,
  })
}

function getPaths(layout: AgentPathLayout) {
  return AgentControlPathsSchema.parse({
    dataDir: layout.dataDir,
    configPath: layout.configPath,
    releasesDir: layout.releasesDir,
    logsDir: layout.logsDir,
    releaseStatePath: layout.releaseStatePath,
    runtimeHealthPath: layout.runtimeHealthPath,
    supervisorControlPath: layout.supervisorControlPath,
    controlOverridesPath: layout.controlOverridesPath,
    controlRemoteCachePath: layout.controlRemoteCachePath,
    infraConfigPath: layout.infraConfigPath,
    auditLogPath: layout.auditLogPath,
  })
}

async function withSnapshotResult(
  layout: AgentPathLayout,
  message: string,
): Promise<z.infer<typeof AgentControlCommandResultSchema>> {
  const result = await syncSnapshot(layout)
  return AgentControlCommandResultSchema.parse({
    ok: true,
    message,
    snapshot: result.snapshot,
  })
}

export function createAgentControlLocalService(
  deps: CreateAgentControlLocalServiceDeps,
): AgentControlLocalService {
  const adapter = deps.adapter ?? resolveLocalControlAdapter()

  return {
    getAgentOperationalSnapshot() {
      return syncSnapshot(deps.layout)
    },
    getLogs(command) {
      return readLogs(deps.layout, command)
    },
    getReleaseInventory() {
      return listReleaseInventory(deps.layout)
    },
    getPaths() {
      return getPaths(deps.layout)
    },
    async startAgent() {
      await adapter.startAgent()
      return withSnapshotResult(deps.layout, 'Agent start requested')
    },
    async stopAgent() {
      await adapter.stopAgent()
      return withSnapshotResult(deps.layout, 'Agent stop requested')
    },
    async restartAgent() {
      await adapter.restartAgent()
      return withSnapshotResult(deps.layout, 'Agent restart requested')
    },
    async pauseUpdates() {
      setLocalUpdatesPaused({
        layout: deps.layout,
        paused: true,
      })
      return withSnapshotResult(deps.layout, 'Local update pause enabled')
    },
    async resumeUpdates() {
      setLocalUpdatesPaused({
        layout: deps.layout,
        paused: false,
      })
      return withSnapshotResult(deps.layout, 'Local update pause cleared')
    },
    async changeChannel(channel) {
      setLocalChannel({
        layout: deps.layout,
        channel,
      })
      return withSnapshotResult(
        deps.layout,
        channel ? `Local update channel set to ${channel}` : 'Local update channel reset to base',
      )
    },
    async setBlockedVersions(versions) {
      setLocalBlockedVersions({
        layout: deps.layout,
        blockedVersions: versions,
      })
      return withSnapshotResult(deps.layout, 'Local blocked versions updated')
    },
    async updateConfig(patch) {
      updateLocalEditableConfig({
        layout: deps.layout,
        patch,
      })
      return withSnapshotResult(deps.layout, 'Local editable config updated')
    },
    async activateRelease(version) {
      const syncResult = await syncSnapshot(deps.layout)
      const releaseDir = path.join(deps.layout.releasesDir, version)
      if (!fs.existsSync(releaseDir)) {
        throw new Error(`Release ${version} is not installed`)
      }

      if (!resolveReleaseEntrypoint(releaseDir)) {
        throw new Error(`Release ${version} has no executable entrypoint`)
      }

      if (syncResult.snapshot.updates.blockedVersions.effective.includes(version)) {
        throw new Error(`Release ${version} is blocked by effective policy`)
      }

      const nowIso = new Date().toISOString()
      writeReleaseState(deps.layout.releaseStatePath, {
        ...syncResult.releaseState,
        target_version: version,
        activation_state: 'pending',
        last_update_attempt: nowIso,
        last_error: null,
        automatic_updates_blocked: false,
      })
      writeSupervisorControl(deps.layout.supervisorControlPath, {
        drain_requested: true,
        reason: 'update',
        requested_at: nowIso,
      })
      recordOperationalEvent(deps.layout, {
        type: 'RELEASE_ACTIVATED',
        occurredAt: nowIso,
        source: 'LOCAL',
        message: `Release ${version} marked for activation`,
        metadata: {
          version,
        },
      })
      return withSnapshotResult(deps.layout, `Release ${version} marked for activation`)
    },
    async rollbackRelease() {
      const currentConfig = requireCurrentConfig(deps.layout)
      const state = readReleaseState(deps.layout.releaseStatePath, currentConfig.AGENT_ID)
      const rollbackVersion = state.previous_version ?? state.last_known_good_version
      if (!rollbackVersion || rollbackVersion === state.current_version) {
        throw new Error('No rollback target is available')
      }

      const nowIso = new Date().toISOString()
      const rolledBackState = rollbackReleaseState({
        layout: deps.layout,
        state,
        rollbackVersion,
        nowIso,
        reason: 'manual rollback requested from local control UI',
      })
      writeReleaseState(deps.layout.releaseStatePath, rolledBackState)
      writeSupervisorControl(deps.layout.supervisorControlPath, {
        drain_requested: true,
        reason: 'manual',
        requested_at: nowIso,
      })
      recordOperationalEvent(deps.layout, {
        type: 'ROLLBACK_EXECUTED',
        occurredAt: nowIso,
        source: 'LOCAL',
        message: `Rollback executed to ${rollbackVersion}`,
        metadata: {
          rollbackVersion,
        },
      })
      return withSnapshotResult(deps.layout, `Rollback executed to ${rollbackVersion}`)
    },
    async executeLocalReset() {
      try {
        await adapter.stopAgent()
      } catch {
        // Reset must still proceed when the service is already stopped or unavailable.
      }

      const result = await executeLocalReset({
        layout: deps.layout,
        currentConfig: requireCurrentConfig(deps.layout),
        source: 'LOCAL',
      })

      await adapter.startAgent()

      return AgentControlCommandResultSchema.parse({
        ok: true,
        message: 'Local reset executed and runtime restart requested',
        snapshot: result.snapshot,
      })
    },
  }
}

export type { AgentControlLocalService, AgentLocalControlAdapter }
