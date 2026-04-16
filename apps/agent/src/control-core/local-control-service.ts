import fs from 'node:fs'
import path from 'node:path'
import { readAgentEnvFileValues } from '@agent/config/agent-env'
import type { AgentPathLayout } from '@agent/config/config.contract'
import {
  type ControlRuntimeConfig,
  ControlRuntimeConfigSchema,
  executeLocalReset,
  readCurrentControlRuntimeConfig,
  recordOperationalEvent,
  serializeRuntimeConfig,
  setLocalBlockedVersions,
  setLocalChannel,
  setLocalUpdatesPaused,
  syncAgentControlState,
  updateLocalEditableConfig,
} from '@agent/control-core/agent-control-core'
import {
  AgentControlBackendStateSchema,
  AgentControlBackendUpdateResultSchema,
  AgentControlCommandResultSchema,
  AgentControlLogChannelSchema,
  AgentControlLogsResponseSchema,
  type AgentControlPaths,
} from '@agent/control-core/contracts'
import { sortMergedLogLinesByTimestamp } from '@agent/control-core/log-ordering'
import {
  buildAgentControlPaths,
  buildAgentReleaseInventory,
  readAgentControlPublicState,
} from '@agent/control-core/public-control-state'
import { resolvePlatformAdapter } from '@agent/platform/platform.adapter'
import type { AgentPlatformControlAdapter } from '@agent/platform/platform.contract'
import { requestReleaseActivation } from '@agent/release/application/activate-release'
import { resolveReleaseEntrypoint } from '@agent/release/application/release-layout'
import { requestReleaseRollback } from '@agent/release/application/rollback-release'
import { readReleaseState } from '@agent/release/infrastructure/release-state.file-repository'
import { writeSupervisorControl } from '@agent/runtime/infrastructure/supervisor-control.repository'
import {
  resolveAgentPublicBackendStatePath,
  resolveAgentPublicStatePath,
} from '@agent/runtime/paths'
import { writeFileAtomic } from '@agent/state/file-io'
import {
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

type AgentLocalControlAdapter = AgentPlatformControlAdapter

type AgentControlLocalService = {
  readonly getAgentOperationalSnapshot: () => ReturnType<typeof syncSnapshot>
  readonly getBackendState: () => z.infer<typeof AgentControlBackendStateSchema>
  readonly getLogs: (command?: {
    readonly channel?: z.infer<typeof AgentControlLogChannelSchema>
    readonly tail?: number
  }) => ReturnType<typeof readLogs>
  readonly getReleaseInventory: () => ReturnType<typeof listReleaseInventory>
  readonly getPaths: () => AgentControlPaths
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
  readonly setBackendUrl: (
    backendUrl: string,
  ) => Promise<z.infer<typeof AgentControlBackendUpdateResultSchema>>
  readonly activateRelease: (
    version: string,
  ) => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly rollbackRelease: () => Promise<z.infer<typeof AgentControlCommandResultSchema>>
  readonly executeLocalReset: () => Promise<z.infer<typeof AgentControlCommandResultSchema>>
}

type CreateAgentControlLocalServiceDeps = {
  readonly layout: AgentPathLayout
  readonly adapter?: AgentPlatformControlAdapter
}

function resolveLocalControlAdapter(): AgentPlatformControlAdapter {
  return resolvePlatformAdapter().control
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeBackendUrl(value: string): string {
  const trimmed = value.trim()
  const url = new URL(trimmed)
  return url.toString().replace(/\/+$/u, '')
}

function readBackendUrlFromEnvFile(filePath: string): string | null {
  const values = readAgentEnvFileValues(filePath)
  if (!values) {
    return null
  }

  const backendUrl = normalizeOptionalString(values.get('BACKEND_URL'))
  if (!backendUrl) {
    return null
  }

  try {
    return normalizeBackendUrl(backendUrl)
  } catch {
    return null
  }
}

function hasInstallerToken(filePath: string): boolean {
  const values = readAgentEnvFileValues(filePath)
  if (!values) {
    return false
  }

  const installerToken = normalizeOptionalString(values.get('INSTALLER_TOKEN'))
  return installerToken !== null && installerToken !== '[REDACTED]'
}

function upsertEnvFileValue(command: {
  readonly filePath: string
  readonly key: string
  readonly value: string
  readonly createIfMissing?: boolean
}): boolean {
  if (!fs.existsSync(command.filePath)) {
    if (command.createIfMissing !== true) {
      return false
    }

    writeFileAtomic(command.filePath, `${command.key}=${command.value}\n`)
    return true
  }

  const lines = fs.readFileSync(command.filePath, 'utf8').split(/\r?\n/u)
  let replaced = false
  const nextLines = lines.map((line) => {
    const parsed = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u)
    if (!parsed || parsed[1] !== command.key) {
      return line
    }

    replaced = true
    return `${command.key}=${command.value}`
  })

  if (!replaced) {
    const insertionIndex = nextLines.at(-1) === '' ? nextLines.length - 1 : nextLines.length
    nextLines.splice(insertionIndex, 0, `${command.key}=${command.value}`)
  }

  writeFileAtomic(command.filePath, `${nextLines.join('\n')}\n`)
  return true
}

function clearPublicStateFiles(): void {
  removeStateFile(resolveAgentPublicStatePath())
  removeStateFile(resolveAgentPublicBackendStatePath())
}

function invalidateRemoteCaches(layout: AgentPathLayout): void {
  for (const cachePath of [layout.controlRemoteCachePath, layout.infraConfigPath]) {
    removeStateFile(cachePath)
  }
}

export function readAgentControlBackendState(layout: AgentPathLayout) {
  const publicStateAvailable = readAgentControlPublicState(resolveAgentPublicStatePath()) !== null
  const runtimeConfigMaterialized = fs.existsSync(layout.configEnvPath)
  const baseRuntimeConfigAvailable = fs.existsSync(layout.baseRuntimeConfigPath)
  const runtimeConfigAvailable =
    readCurrentControlRuntimeConfig(layout) !== null &&
    (runtimeConfigMaterialized || baseRuntimeConfigAvailable)
  const currentConfig = readCurrentControlRuntimeConfig(layout)
  const bootstrapConfigAvailable = fs.existsSync(layout.bootstrapEnvPath)
  const consumedBootstrapAvailable = fs.existsSync(layout.consumedBootstrapEnvPath)
  const installerTokenAvailable = hasInstallerToken(layout.bootstrapEnvPath)
  const bootstrapBackendUrl = readBackendUrlFromEnvFile(layout.bootstrapEnvPath)
  const consumedBootstrapBackendUrl = readBackendUrlFromEnvFile(layout.consumedBootstrapEnvPath)

  let backendUrl: string | null = null
  let source: z.infer<typeof AgentControlBackendStateSchema>['source'] = 'NONE'

  if (currentConfig && runtimeConfigMaterialized) {
    backendUrl = currentConfig.BACKEND_URL
    source = 'RUNTIME_CONFIG'
  } else if (bootstrapBackendUrl) {
    backendUrl = bootstrapBackendUrl
    source = 'BOOTSTRAP'
  } else if (consumedBootstrapBackendUrl) {
    backendUrl = consumedBootstrapBackendUrl
    source = 'CONSUMED_BOOTSTRAP'
  } else if (currentConfig) {
    backendUrl = currentConfig.BACKEND_URL
    source = 'BASE_RUNTIME_CONFIG'
  }

  let status: z.infer<typeof AgentControlBackendStateSchema>['status'] = 'UNCONFIGURED'
  if (runtimeConfigAvailable) {
    status = 'ENROLLED'
  } else if (bootstrapConfigAvailable || consumedBootstrapAvailable) {
    status = 'BOOTSTRAP_ONLY'
  }

  const warnings: string[] = []
  if (!runtimeConfigAvailable && !installerTokenAvailable) {
    warnings.push(
      'No installer token is available in bootstrap.env. A valid bootstrap file is required before the agent can enroll.',
    )
  } else if (runtimeConfigAvailable && !installerTokenAvailable) {
    warnings.push(
      'This agent is already enrolled. Switching to a different backend may require a fresh bootstrap token if the current agent token is rejected.',
    )
  }

  return AgentControlBackendStateSchema.parse({
    backendUrl,
    source,
    status,
    runtimeConfigAvailable,
    bootstrapConfigAvailable,
    installerTokenAvailable,
    publicStateAvailable,
    warnings,
  })
}

function requireCurrentConfig(layout: AgentPathLayout): ControlRuntimeConfig {
  const config = readCurrentControlRuntimeConfig(layout)
  if (!config) {
    throw new Error(`Agent runtime config is unavailable at ${layout.configEnvPath}`)
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
  const currentConfig = readCurrentControlRuntimeConfig(layout)
  const state = readReleaseState(layout.releaseStatePath, currentConfig?.AGENT_ID ?? 'unknown')
  return buildAgentReleaseInventory({
    layout,
    releaseState: state,
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
    parsedChannel === 'all' ? ['stdout', 'stderr', 'supervisor'] : [parsedChannel]

  const mergedLines = channels.flatMap((channel) =>
    readLogLines(path.join(layout.logsDir, LOG_FILE_BY_CHANNEL[channel]), channel, tail),
  )
  const lines = parsedChannel === 'all' ? sortMergedLogLinesByTimestamp(mergedLines) : mergedLines

  return AgentControlLogsResponseSchema.parse({
    lines,
  })
}

function getPaths(layout: AgentPathLayout) {
  return buildAgentControlPaths(layout)
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
    getBackendState() {
      return readAgentControlBackendState(deps.layout)
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
    async setBackendUrl(backendUrl) {
      const normalizedBackendUrl = normalizeBackendUrl(backendUrl)
      const currentConfig = readCurrentControlRuntimeConfig(deps.layout)
      const runtimeConfigMaterialized = fs.existsSync(deps.layout.configEnvPath)
      const bootstrapConfigMaterialized = fs.existsSync(deps.layout.bootstrapEnvPath)
      const consumedBootstrapConfigMaterialized = fs.existsSync(
        deps.layout.consumedBootstrapEnvPath,
      )
      let updated = false

      if (currentConfig) {
        const nextConfig = ControlRuntimeConfigSchema.parse({
          ...currentConfig,
          BACKEND_URL: normalizedBackendUrl,
        })
        writeStateJsonFile({
          filePath: deps.layout.baseRuntimeConfigPath,
          schema: ControlRuntimeConfigSchema,
          value: nextConfig,
        })
        if (runtimeConfigMaterialized) {
          writeFileAtomic(deps.layout.configEnvPath, serializeRuntimeConfig(nextConfig))
        }
        updated = true
      }

      if (
        bootstrapConfigMaterialized &&
        upsertEnvFileValue({
          filePath: deps.layout.bootstrapEnvPath,
          key: 'BACKEND_URL',
          value: normalizedBackendUrl,
        })
      ) {
        updated = true
      } else if (
        consumedBootstrapConfigMaterialized &&
        upsertEnvFileValue({
          filePath: deps.layout.consumedBootstrapEnvPath,
          key: 'BACKEND_URL',
          value: normalizedBackendUrl,
        })
      ) {
        updated = true
      }

      if (!updated) {
        throw new Error(
          `No runtime or bootstrap configuration is available to store BACKEND_URL under ${deps.layout.dataDir}`,
        )
      }

      invalidateRemoteCaches(deps.layout)
      clearPublicStateFiles()
      recordOperationalEvent(deps.layout, {
        type: 'CONFIG_UPDATED',
        occurredAt: new Date().toISOString(),
        source: 'LOCAL',
        message: `Backend URL updated to ${normalizedBackendUrl}`,
        metadata: {
          backendUrl: normalizedBackendUrl,
        },
      })

      await adapter.restartAgent()

      return AgentControlBackendUpdateResultSchema.parse({
        ok: true,
        message: `Backend URL updated to ${normalizedBackendUrl} and service restart requested`,
        state: readAgentControlBackendState(deps.layout),
      })
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
      requestReleaseActivation({
        layout: deps.layout,
        fallbackVersion: syncResult.releaseState.current_version,
        targetVersion: version,
        nowIso,
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
      requestReleaseRollback({
        layout: deps.layout,
        fallbackVersion: state.current_version,
        rollbackVersion,
        nowIso,
        reason: 'manual rollback requested from local control UI',
      })
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
