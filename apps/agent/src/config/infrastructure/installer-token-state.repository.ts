import type { PlatformPathResolution } from '@agent/platform/platform.contract'
import {
  readStateJsonFile,
  removeStateFile,
  writeStateJsonFile,
} from '@agent/state/infrastructure/json-state.file-store'
import { z } from 'zod/v4'

const installerTokenStateSchema = z.object({
  installerToken: z.string().min(1),
  updatedAt: z.string().datetime({ offset: true }),
})

export type InstallerTokenState = z.infer<typeof installerTokenStateSchema>

export function readInstallerTokenState(command: {
  readonly paths: PlatformPathResolution
}): InstallerTokenState | null {
  return readStateJsonFile({
    filePath: command.paths.installerTokenStatePath,
    schema: installerTokenStateSchema,
  })
}

export function readInstallerTokenValue(command: {
  readonly paths: PlatformPathResolution
}): string | null {
  return readInstallerTokenState(command)?.installerToken ?? null
}

export function writeInstallerTokenState(command: {
  readonly paths: PlatformPathResolution
  readonly installerToken: string
}): InstallerTokenState {
  return writeStateJsonFile({
    filePath: command.paths.installerTokenStatePath,
    schema: installerTokenStateSchema,
    value: {
      installerToken: command.installerToken,
      updatedAt: new Date().toISOString(),
    },
    mode: 0o600,
  })
}

export function clearInstallerTokenState(command: {
  readonly paths: PlatformPathResolution
}): void {
  removeStateFile(command.paths.installerTokenStatePath)
}
