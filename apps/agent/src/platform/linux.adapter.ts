import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { ensureDirectory, runCommand, tryCommand } from '@agent/platform/common'
import { createLinuxLocalControlAdapter } from '@agent/platform/local-control.adapter'
import type { AgentPlatformAdapter } from '@agent/platform/platform.types'

const DEFAULT_DATA_DIR_NAME = 'ContainerTracker'
export const LINUX_SYSTEM_DATA_DIR = '/var/lib/container-tracker-agent'
const DEV_FALLBACK_DIR_NAME = '.agent-runtime'

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
    return path.resolve(command.cwd, DEV_FALLBACK_DIR_NAME)
  }

  const xdgDataHome = normalizeOptionalEnv(command.env.XDG_DATA_HOME)
  if (xdgDataHome) {
    return path.join(xdgDataHome, DEFAULT_DATA_DIR_NAME)
  }

  return path.join(os.homedir(), '.local', 'share', DEFAULT_DATA_DIR_NAME)
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
      normalizeOptionalEnv(command.env.BOOTSTRAP_DOTENV_PATH) ?? path.join(dataDir, 'bootstrap.env')
    const configEnvPath =
      normalizeOptionalEnv(command.env.DOTENV_PATH) ?? path.join(dataDir, 'config.env')
    const publicStateDir =
      normalizeOptionalEnv(command.env.AGENT_PUBLIC_STATE_DIR) ?? path.join(dataDir, 'run')

    return {
      dataDir,
      releasesDir: path.join(dataDir, 'releases'),
      currentPath: path.join(dataDir, 'current'),
      previousPath: path.join(dataDir, 'previous'),
      logsDir: path.join(dataDir, 'logs'),
      releaseStatePath: path.join(dataDir, 'release-state.json'),
      runtimeStatePath: path.join(dataDir, 'runtime-state.json'),
      configEnvPath,
      bootstrapEnvPath,
      consumedBootstrapEnvPath: `${bootstrapEnvPath}.consumed`,
      downloadsDir: path.join(dataDir, 'downloads'),
      baseRuntimeConfigPath: path.join(dataDir, 'control-base.runtime.json'),
      supervisorControlPath: path.join(dataDir, 'supervisor-control.json'),
      pendingActivityPath: path.join(dataDir, 'pending-activity-events.json'),
      controlOverridesPath: path.join(dataDir, 'control-overrides.local.json'),
      controlRemoteCachePath: path.join(dataDir, 'control-remote-cache.json'),
      infraConfigPath: path.join(dataDir, 'infra-config.json'),
      auditLogPath: path.join(dataDir, 'agent-control-audit.ndjson'),
      publicStateDir,
      publicStatePath: path.join(publicStateDir, 'control-ui-state.json'),
      publicBackendStatePath: path.join(publicStateDir, 'control-ui-backend-state.json'),
      publicLogsPath: path.join(publicStateDir, 'control-ui-logs.json'),
      agentLogForwarderStatePath: path.join(dataDir, 'agent-log-forwarder-state.json'),
    }
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
