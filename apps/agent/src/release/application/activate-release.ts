import fs from 'node:fs'
import type { AgentPathLayout } from '@agent/config/config.contract'
import type { ReleaseState } from '@agent/core/contracts/release-state.contract'
import { resolvePlatformAdapter } from '@agent/platform/platform.adapter'
import {
  resolveReleaseDir,
  resolveReleaseEntrypoint,
} from '@agent/release/application/release-layout'
import {
  readReleaseState,
  writeReleaseState,
} from '@agent/release/infrastructure/release-state.file-repository'

function basenameFromPath(targetPath: string | null): string | null {
  if (!targetPath) {
    return null
  }

  const segments = targetPath.replaceAll('\\', '/').split('/')
  const base = segments.at(-1)
  return typeof base === 'string' && base.length > 0 ? base : null
}

export function markReleaseForActivation(command: {
  readonly layout: AgentPathLayout
  readonly state: ReleaseState
  readonly targetVersion: string
  readonly nowIso: string
}): ReleaseState {
  const targetDir = resolveReleaseDir(command.layout.releasesDir, command.targetVersion)
  if (!fs.existsSync(targetDir)) {
    throw new Error(`target release is missing: ${targetDir}`)
  }

  const targetEntrypoint = resolveReleaseEntrypoint(targetDir)
  if (!targetEntrypoint) {
    throw new Error(`target release has no valid entrypoint: ${targetDir}`)
  }

  return {
    ...command.state,
    target_version: command.targetVersion,
    activation_state: 'pending',
    last_update_attempt: command.nowIso,
    last_error: null,
    automatic_updates_blocked: false,
  }
}

export function requestReleaseActivation(command: {
  readonly layout: AgentPathLayout
  readonly fallbackVersion: string
  readonly targetVersion: string
  readonly nowIso: string
}): ReleaseState {
  const currentState = readReleaseState(command.layout.releaseStatePath, command.fallbackVersion)
  const nextState = markReleaseForActivation({
    layout: command.layout,
    state: currentState,
    targetVersion: command.targetVersion,
    nowIso: command.nowIso,
  })
  writeReleaseState(command.layout.releaseStatePath, nextState)
  return nextState
}

export function activatePendingRelease(command: {
  readonly layout: AgentPathLayout
  readonly state: ReleaseState
  readonly targetVersion: string
  readonly nowIso: string
}): ReleaseState {
  const platformAdapter = resolvePlatformAdapter()
  const targetDir = resolveReleaseDir(command.layout.releasesDir, command.targetVersion)
  if (!fs.existsSync(targetDir)) {
    throw new Error(`target release is missing: ${targetDir}`)
  }

  const targetEntrypoint = resolveReleaseEntrypoint(targetDir)
  if (!targetEntrypoint) {
    throw new Error(`target release has no valid entrypoint: ${targetDir}`)
  }

  const currentRealPath = platformAdapter.readSymlinkOrPointer({
    pointerPath: command.layout.currentPath,
  })
  const previousVersionFromLink = basenameFromPath(currentRealPath)

  platformAdapter.switchCurrentRelease({
    currentPath: command.layout.currentPath,
    previousPath: command.layout.previousPath,
    targetPath: targetDir,
  })

  return {
    ...command.state,
    previous_version: previousVersionFromLink ?? command.state.current_version,
    current_version: command.targetVersion,
    target_version: command.targetVersion,
    activation_state: 'verifying',
    last_update_attempt: command.nowIso,
    last_error: null,
  }
}

export function confirmActivatedRelease(command: {
  readonly state: ReleaseState
  readonly confirmedVersion: string
  readonly nowIso: string
}): ReleaseState {
  const activationFailures = { ...command.state.activation_failures }
  delete activationFailures[command.confirmedVersion]

  return {
    ...command.state,
    current_version: command.confirmedVersion,
    previous_version: command.state.previous_version ?? command.state.last_known_good_version,
    last_known_good_version: command.confirmedVersion,
    target_version: null,
    activation_state: 'idle',
    failure_count: 0,
    activation_failures: activationFailures,
    last_update_attempt: command.nowIso,
    last_error: null,
  }
}
