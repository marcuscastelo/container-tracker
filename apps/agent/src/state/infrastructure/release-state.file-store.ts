import type { ReleaseState } from '@agent/core/contracts/release-state.contract'
import type { PlatformPathResolution } from '@agent/platform/platform.contract'
import { writeFileAtomic } from '@agent/state/file-io'
import { serializeReleaseState, toReleaseState } from '@agent/state/release-state.mapper'
import fs from 'node:fs'

export function writeReleaseStateFile(command: {
  readonly paths: PlatformPathResolution
  readonly state: ReleaseState
}): void {
  writeFileAtomic(command.paths.releaseStatePath, serializeReleaseState(command.state))
}

export function readReleaseStateFile(command: {
  readonly paths: PlatformPathResolution
}): ReleaseState | null {
  return readReleaseStateAtPath(command.paths.releaseStatePath)
}

export function writeReleaseStateAtPath(filePath: string, state: ReleaseState): void {
  writeFileAtomic(filePath, serializeReleaseState(state))
}

export function readReleaseStateAtPath(filePath: string): ReleaseState | null {
  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    return toReleaseState(parsed)
  } catch {
    return null
  }
}
