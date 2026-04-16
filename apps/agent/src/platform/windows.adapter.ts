import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { AGENT_PATH_LAYOUT, resolveAgentPathLayoutPaths } from '@agent/platform/agent-path-layout'
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
  const explicitDataDir = normalizeOptionalEnv(env.AGENT_DATA_DIR)
  if (explicitDataDir) {
    return explicitDataDir
  }

  const localAppData = normalizeOptionalEnv(env.LOCALAPPDATA)
  if (localAppData) {
    return path.win32.join(localAppData, DEFAULT_DATA_DIR_NAME)
  }

  return path.win32.join(os.homedir(), 'AppData', 'Local', DEFAULT_DATA_DIR_NAME)
}

function removePathIfExists(targetPath: string): void {
  try {
    fs.rmSync(targetPath, { recursive: true, force: true })
  } catch {
    // best effort cleanup
  }
}

function linkDirectory(linkPath: string, targetPath: string): void {
  removePathIfExists(linkPath)
  fs.symlinkSync(targetPath, linkPath, 'junction')
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
    const dataDir = resolveDataDir(command.env)
    const bootstrapEnvPath =
      normalizeOptionalEnv(command.env.BOOTSTRAP_DOTENV_PATH) ??
      path.win32.join(dataDir, AGENT_PATH_LAYOUT.files.bootstrapEnv)
    const configEnvPath =
      normalizeOptionalEnv(command.env.DOTENV_PATH) ??
      path.win32.join(dataDir, AGENT_PATH_LAYOUT.files.configEnv)
    const publicStateDir =
      normalizeOptionalEnv(command.env.AGENT_PUBLIC_STATE_DIR) ??
      path.win32.join(dataDir, AGENT_PATH_LAYOUT.directories.publicState)

    return resolveAgentPathLayoutPaths({
      dataDir,
      bootstrapEnvPath,
      publicStateDir,
      configEnvPath,
      joinPath: path.win32.join,
    })
  },
  ensureDirectories(command) {
    fs.mkdirSync(command.paths.dataDir, { recursive: true })
    fs.mkdirSync(command.paths.releasesDir, { recursive: true })
    fs.mkdirSync(command.paths.downloadsDir, { recursive: true })
    fs.mkdirSync(command.paths.logsDir, { recursive: true })
    fs.mkdirSync(command.paths.publicStateDir, { recursive: true })
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
  readSymlinkOrPointer(command) {
    try {
      return fs.realpathSync(command.pointerPath)
    } catch {
      return null
    }
  },
  switchCurrentRelease(command) {
    const previousTargetPath =
      typeof command.previousTargetPath === 'string'
        ? command.previousTargetPath
        : windowsPlatformAdapter.readSymlinkOrPointer({ pointerPath: command.currentPath })

    if (previousTargetPath) {
      linkDirectory(command.previousPath, previousTargetPath)
    } else {
      removePathIfExists(command.previousPath)
    }

    linkDirectory(command.currentPath, command.targetPath)
  },
}
