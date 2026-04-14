import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { ensureDirectory, runCommand, tryCommand } from '@agent/platform/common'
import { createWindowsLocalControlAdapter } from '@agent/platform/local-control.adapter'
import type { AgentPlatformAdapter } from '@agent/platform/platform.types'

const DEFAULT_DATA_DIR_NAME = 'ContainerTracker'

function normalizeOptionalEnv(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function resolveDataDir(env: NodeJS.ProcessEnv): string {
  const localAppData = normalizeOptionalEnv(env.LOCALAPPDATA)
  if (localAppData) {
    return path.win32.join(localAppData, DEFAULT_DATA_DIR_NAME)
  }

  return path.win32.join(os.homedir(), 'AppData', 'Local', DEFAULT_DATA_DIR_NAME)
}

function extractZipOnWindows(archivePath: string, destinationDir: string): void {
  if (tryCommand('tar', ['-xf', archivePath, '-C', destinationDir])) {
    return
  }

  const command = [
    `$zip='${archivePath.replaceAll("'", "''")}'`,
    `$destination='${destinationDir.replaceAll("'", "''")}'`,
    'Expand-Archive -LiteralPath $zip -DestinationPath $destination -Force',
  ].join('; ')
  runCommand('powershell', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    command,
  ])
}

function extractArchive(command: {
  readonly archiveKind: 'zip' | 'tar' | 'tgz'
  readonly archivePath: string
  readonly destinationDir: string
}): void {
  ensureDirectory(command.destinationDir)

  if (command.archiveKind === 'zip') {
    extractZipOnWindows(command.archivePath, command.destinationDir)
    return
  }

  if (command.archiveKind === 'tgz') {
    runCommand('tar', ['-xzf', command.archivePath, '-C', command.destinationDir])
    return
  }

  runCommand('tar', ['-xf', command.archivePath, '-C', command.destinationDir])
}

export const windowsPlatformAdapter: AgentPlatformAdapter = {
  key: 'windows-x64',
  control: createWindowsLocalControlAdapter(),
  resolvePaths(command) {
    return {
      dataDir: resolveDataDir(command.env),
    }
  },
  startRuntime(command) {
    return spawn(process.execPath, [...(command.execArgv ?? []), command.scriptPath], {
      env: command.env,
      stdio: command.stdio,
      shell: false,
    })
  },
  stopRuntime(command) {
    command.child.kill()
  },
  restartRuntime(command) {
    command.child.kill()
    return spawn(process.execPath, [...(command.next.execArgv ?? []), command.next.scriptPath], {
      env: command.next.env,
      stdio: command.next.stdio,
      shell: false,
    })
  },
  extractBundle(command) {
    extractArchive(command)
  },
}
