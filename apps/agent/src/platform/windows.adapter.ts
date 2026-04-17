import { spawn } from 'node:child_process'
import fs from 'node:fs'
import process from 'node:process'

import { ensureDirectory, runCommand, tryCommand } from '@agent/platform/common'
import { createWindowsLocalControlAdapter } from '@agent/platform/local-control.adapter'
import type { AgentPlatformAdapter } from '@agent/platform/platform.types'
import { resolveWindowsPlatformPaths } from '@agent/platform/windows-paths'

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
    return resolveWindowsPlatformPaths(command.env)
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
