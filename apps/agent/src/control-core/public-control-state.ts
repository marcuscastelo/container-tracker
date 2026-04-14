import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  type AgentControlBackendState,
  type AgentControlPaths,
  AgentControlPathsSchema,
  type AgentControlPublicState,
  AgentControlPublicStateSchema,
  type AgentOperationalSnapshot,
  type AgentReleaseInventory,
  AgentReleaseInventorySchema,
} from '@agent/control-core/contracts'
import { resolveReleaseEntrypoint } from '@agent/release-manager'
import type { ReleaseState } from '@agent/release-state'
import type { AgentPathLayout } from '@agent/runtime-paths'

function writeFileAtomic(filePath: string, content: string): void {
  const parentDir = path.dirname(filePath)
  fs.mkdirSync(parentDir, { recursive: true })

  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(tempPath, content, 'utf8')
  fs.renameSync(tempPath, filePath)
}

export function buildAgentControlPaths(layout: AgentPathLayout): AgentControlPaths {
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

export function buildAgentReleaseInventory(command: {
  readonly layout: AgentPathLayout
  readonly releaseState: ReleaseState
}): AgentReleaseInventory {
  const entries = fs.existsSync(command.layout.releasesDir)
    ? fs
        .readdirSync(command.layout.releasesDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : []

  return AgentReleaseInventorySchema.parse({
    releases: [...entries]
      .sort((left, right) =>
        right.localeCompare(left, undefined, { numeric: true, sensitivity: 'base' }),
      )
      .map((version) => {
        const releaseDir = path.join(command.layout.releasesDir, version)
        return {
          version,
          isCurrent: command.releaseState.current_version === version,
          isPrevious: command.releaseState.previous_version === version,
          isTarget: command.releaseState.target_version === version,
          entrypointPath: resolveReleaseEntrypoint(releaseDir),
        }
      }),
  })
}

export function writeAgentControlPublicState(command: {
  readonly filePath: string
  readonly snapshot: AgentOperationalSnapshot
  readonly releaseInventory: AgentReleaseInventory
  readonly paths: AgentControlPaths
  readonly backendState?: AgentControlBackendState
}): AgentControlPublicState {
  const state = AgentControlPublicStateSchema.parse({
    snapshot: command.snapshot,
    releaseInventory: command.releaseInventory,
    paths: command.paths,
    backendState: command.backendState,
  })

  writeFileAtomic(command.filePath, `${JSON.stringify(state, null, 2)}\n`)
  fs.chmodSync(command.filePath, 0o644)
  return state
}

export function readAgentControlPublicState(filePath: string): AgentControlPublicState | null {
  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    const normalized = AgentControlPublicStateSchema.safeParse(parsed)
    if (!normalized.success) {
      return null
    }

    return normalized.data
  } catch {
    return null
  }
}
