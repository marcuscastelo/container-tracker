import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { AGENT_PATH_LAYOUT, resolveAgentPathLayoutPaths } from '@agent/platform/agent-path-layout'
import { ensureDirectory, runCommand, tryCommand } from '@agent/platform/common'
import { createLinuxLocalControlAdapter } from '@agent/platform/local-control.adapter'
import type { AgentPlatformAdapter } from '@agent/platform/platform.types'

const DEFAULT_DATA_DIR_NAME = 'ContainerTracker'
export const LINUX_SYSTEM_DATA_DIR = '/var/lib/container-tracker-agent'
const DEV_FALLBACK_DIR_NAME = '.agent-runtime'
const linuxPath = path.posix

function normalizeOptionalEnv(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function canUseLinuxSystemDir(candidate: string): boolean {
  try {
    fs.mkdirSync(candidate, { recursive: true })
    fs.accessSync(candidate, fs.constants.R_OK | fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

function resolveDataDir(command: {
  readonly env: NodeJS.ProcessEnv
  readonly cwd?: string
}): string {
  const explicitDataDir = normalizeOptionalEnv(command.env.AGENT_DATA_DIR)
  if (explicitDataDir) {
    return explicitDataDir
  }

  if (canUseLinuxSystemDir(LINUX_SYSTEM_DATA_DIR)) {
    return LINUX_SYSTEM_DATA_DIR
  }

  if (typeof command.cwd === 'string' && command.cwd.length > 0) {
    return linuxPath.resolve(command.cwd, DEV_FALLBACK_DIR_NAME)
  }

  const xdgDataHome = normalizeOptionalEnv(command.env.XDG_DATA_HOME)
  if (xdgDataHome) {
    return linuxPath.join(xdgDataHome, DEFAULT_DATA_DIR_NAME)
  }

  return linuxPath.join(os.homedir(), '.local', 'share', DEFAULT_DATA_DIR_NAME)
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
  fs.symlinkSync(targetPath, linkPath, 'dir')
}

function extractArchive(command: {
  readonly archiveKind: 'zip' | 'tar' | 'tgz'
  readonly archivePath: string
  readonly destinationDir: string
}): void {
  ensureDirectory(command.destinationDir)

  if (command.archiveKind === 'zip') {
    if (tryCommand('unzip', ['-oq', command.archivePath, '-d', command.destinationDir])) {
      return
    }

    runCommand('tar', ['-xf', command.archivePath, '-C', command.destinationDir])
    return
  }

  if (command.archiveKind === 'tgz') {
    runCommand('tar', ['-xzf', command.archivePath, '-C', command.destinationDir])
    return
  }

  runCommand('tar', ['-xf', command.archivePath, '-C', command.destinationDir])
}

export const linuxPlatformAdapter: AgentPlatformAdapter = {
  key: 'linux-x64',
  control: createLinuxLocalControlAdapter(),
  resolvePaths(command) {
    const dataDir = resolveDataDir(command)
    const bootstrapEnvPath =
      normalizeOptionalEnv(command.env.BOOTSTRAP_DOTENV_PATH) ??
      linuxPath.join(dataDir, AGENT_PATH_LAYOUT.files.bootstrapEnv)
    const configEnvPath =
      normalizeOptionalEnv(command.env.DOTENV_PATH) ??
      linuxPath.join(dataDir, AGENT_PATH_LAYOUT.files.configEnv)
    const publicStateDir =
      normalizeOptionalEnv(command.env.AGENT_PUBLIC_STATE_DIR) ??
      linuxPath.join(dataDir, AGENT_PATH_LAYOUT.directories.publicState)

    return resolveAgentPathLayoutPaths({
      dataDir,
      bootstrapEnvPath,
      publicStateDir,
      configEnvPath,
      joinPath: linuxPath.join,
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
    command.child.kill('SIGTERM')
  },
  restartRuntime(command) {
    command.child.kill('SIGTERM')
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
        : linuxPlatformAdapter.readSymlinkOrPointer({ pointerPath: command.currentPath })

    if (previousTargetPath) {
      linkDirectory(command.previousPath, previousTargetPath)
    } else {
      removePathIfExists(command.previousPath)
    }

    linkDirectory(command.currentPath, command.targetPath)
  },
}
