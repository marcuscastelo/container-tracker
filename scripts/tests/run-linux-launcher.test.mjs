import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const launcherPath = path.join(repoRoot, 'scripts', 'agent', 'run-linux.sh')

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function writeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, contents, 'utf8')
  fs.chmodSync(filePath, 0o755)
}

function runLauncher(command = {}) {
  const agentDataDir = makeTempDir('run-linux-launcher-agent-data-')
  const mockNodeDir = makeTempDir('run-linux-launcher-node-')
  const captureFile = path.join(agentDataDir, 'captured-channel.txt')
  const captureDisableFlagFile = path.join(agentDataDir, 'captured-disable-flag.txt')
  const captureArgsFile = path.join(agentDataDir, 'captured-args.txt')

  fs.writeFileSync(
    path.join(agentDataDir, 'config.env'),
    `# config present
AGENT_UPDATE_MANIFEST_CHANNEL=${command.configChannel ?? 'stable'}
`,
    'utf8',
  )

  writeExecutable(
    path.join(mockNodeDir, 'node'),
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s' "\${AGENT_UPDATE_MANIFEST_CHANNEL:-}" > "\${CAPTURE_FILE}"
printf '%s' "\${AGENT_DISABLE_AUTOMATIC_UPDATE_CHECKS:-}" > "\${CAPTURE_DISABLE_FLAG_FILE}"
printf '%s\n' "$@" > "\${CAPTURE_ARGS_FILE}"
`,
  )

  const env = {
    ...process.env,
    AGENT_DATA_DIR: agentDataDir,
    CAPTURE_FILE: captureFile,
    CAPTURE_DISABLE_FLAG_FILE: captureDisableFlagFile,
    CAPTURE_ARGS_FILE: captureArgsFile,
    PATH: [mockNodeDir, process.env.PATH ?? ''].filter(Boolean).join(path.delimiter),
  }

  if (command.agentUpdateManifestChannel === undefined) {
    delete env.AGENT_UPDATE_MANIFEST_CHANNEL
  } else {
    env.AGENT_UPDATE_MANIFEST_CHANNEL = command.agentUpdateManifestChannel
  }

  if (command.disableAutomaticUpdateChecks === undefined) {
    delete env.AGENT_DISABLE_AUTOMATIC_UPDATE_CHECKS
  } else {
    env.AGENT_DISABLE_AUTOMATIC_UPDATE_CHECKS = command.disableAutomaticUpdateChecks
  }

  const result = spawnSync('bash', [launcherPath], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
  })

  return {
    result,
    capturedChannel: fs.readFileSync(captureFile, 'utf8'),
    capturedDisableFlag: fs.readFileSync(captureDisableFlagFile, 'utf8'),
    capturedArgs: fs.readFileSync(captureArgsFile, 'utf8').trim().split('\n').filter(Boolean),
  }
}

describe('run-linux launcher', () => {
  it('defaults AGENT_UPDATE_MANIFEST_CHANNEL from config when no env override is present', () => {
    const { result, capturedChannel, capturedDisableFlag } = runLauncher({
      configChannel: 'stable',
    })

    expect(result.status).toBe(0)
    expect(capturedChannel).toBe('stable')
    expect(capturedDisableFlag).toBe('')
  })

  it('respects explicit AGENT_UPDATE_MANIFEST_CHANNEL overrides', () => {
    const { result, capturedChannel } = runLauncher({
      configChannel: 'stable',
      agentUpdateManifestChannel: 'canary',
    })

    expect(result.status).toBe(0)
    expect(capturedChannel).toBe('canary')
  })

  it('passes through AGENT_DISABLE_AUTOMATIC_UPDATE_CHECKS separately from channel', () => {
    const { result, capturedChannel, capturedDisableFlag } = runLauncher({
      configChannel: 'canary',
      disableAutomaticUpdateChecks: '1',
    })

    expect(result.status).toBe(0)
    expect(capturedChannel).toBe('canary')
    expect(capturedDisableFlag).toBe('1')
  })

  it('starts supervisor with the alias loader when the compiled register module exists', () => {
    const { result, capturedArgs } = runLauncher({
      configChannel: 'stable',
    })
    const registerPath = path.join(
      repoRoot,
      'tools',
      'agent',
      'dist',
      'tools',
      'agent',
      'runtime',
      'register-alias-loader.js',
    )

    expect(result.status).toBe(0)
    expect(capturedArgs.at(-1)).toBe('tools/agent/dist/tools/agent/supervisor.js')

    if (fs.existsSync(registerPath)) {
      expect(capturedArgs).toContain(`--import=${registerPath}`)
      return
    }

    expect(capturedArgs.some((value) => value.startsWith('--import='))).toBe(false)
  })
})
