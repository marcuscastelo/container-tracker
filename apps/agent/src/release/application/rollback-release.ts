import fs from 'node:fs'
import type { AgentPathLayout } from '@agent/config/config.contract'
import type { ReleaseState } from '@agent/core/contracts/release-state.contract'
import { resolvePlatformAdapter } from '@agent/platform/platform.adapter'
import { resolveReleaseDir } from '@agent/release/application/release-layout'
import {
  readReleaseState,
  writeReleaseState,
} from '@agent/release/infrastructure/release-state.file-repository'

function removePathIfExists(targetPath: string): void {
  if (!fs.existsSync(targetPath)) {
    return
  }

  fs.rmSync(targetPath, { recursive: true, force: true })
}

export function selectRollbackVersion(command: {
  readonly releasesDir: string
  readonly lastKnownGoodVersion: string
  readonly previousVersion: string | null
  readonly fallbackVersion: string
}): string {
  const candidates = [
    command.lastKnownGoodVersion,
    command.previousVersion,
    command.fallbackVersion,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

  for (const version of candidates) {
    const releaseDir = resolveReleaseDir(command.releasesDir, version)
    if (fs.existsSync(releaseDir)) {
      return version
    }
  }

  return command.fallbackVersion
}

export function rollbackRelease(command: {
  readonly layout: AgentPathLayout
  readonly state: ReleaseState
  readonly rollbackVersion: string
  readonly nowIso: string
  readonly reason: string
}): ReleaseState {
  const platformAdapter = resolvePlatformAdapter()
  const rollbackDir = resolveReleaseDir(command.layout.releasesDir, command.rollbackVersion)
  if (fs.existsSync(rollbackDir)) {
    platformAdapter.switchCurrentRelease({
      currentPath: command.layout.currentPath,
      previousPath: command.layout.previousPath,
      targetPath: rollbackDir,
    })
  } else {
    removePathIfExists(command.layout.currentPath)
    removePathIfExists(command.layout.previousPath)
  }

  return {
    ...command.state,
    current_version: command.rollbackVersion,
    last_known_good_version: command.rollbackVersion,
    target_version: null,
    activation_state: 'rolled_back',
    last_update_attempt: command.nowIso,
    last_error: command.reason,
  }
}

export function requestReleaseRollback(command: {
  readonly layout: AgentPathLayout
  readonly fallbackVersion: string
  readonly rollbackVersion: string
  readonly nowIso: string
  readonly reason: string
}): ReleaseState {
  const currentState = readReleaseState(command.layout.releaseStatePath, command.fallbackVersion)
  const nextState = rollbackRelease({
    layout: command.layout,
    state: currentState,
    rollbackVersion: command.rollbackVersion,
    nowIso: command.nowIso,
    reason: command.reason,
  })
  writeReleaseState(command.layout.releaseStatePath, nextState)
  return nextState
}
