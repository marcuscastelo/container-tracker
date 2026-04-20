import fs from 'node:fs'
import type { ReleaseState } from '@agent/core/contracts/release-state.contract'
import { createInitialReleaseState, migrateReleaseState } from '@agent/release/domain/release-state'
import {
  readReleaseStateAtPath,
  writeReleaseStateAtPath,
} from '@agent/state/infrastructure/release-state.file-store'

export function writeReleaseState(filePath: string, state: ReleaseState): void {
  writeReleaseStateAtPath(filePath, state)
}

export function readReleaseState(filePath: string, fallbackVersion: string): ReleaseState {
  if (!fs.existsSync(filePath)) {
    const initialState = createInitialReleaseState(fallbackVersion)
    writeReleaseState(filePath, initialState)
    return initialState
  }

  try {
    const parsedState = readReleaseStateAtPath(filePath)
    const parsed =
      parsedState === null
        ? createInitialReleaseState(fallbackVersion)
        : migrateReleaseState(parsedState)
    writeReleaseState(filePath, parsed)
    return parsed
  } catch {
    const fallbackState = createInitialReleaseState(fallbackVersion)
    writeReleaseState(filePath, fallbackState)
    return fallbackState
  }
}
