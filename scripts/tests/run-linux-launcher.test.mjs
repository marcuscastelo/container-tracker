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

function runLauncher(agentUpdateManifestChannel) {
  const agentDataDir = makeTempDir('run-linux-launcher-agent-data-')
  const mockNodeDir = makeTempDir('run-linux-launcher-node-')
  const captureFile = path.join(agentDataDir, 'captured-channel.txt')

  fs.writeFileSync(path.join(agentDataDir, 'config.env'), '# config present\n', 'utf8')

  writeExecutable(
    path.join(mockNodeDir, 'node'),
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s' "\${AGENT_UPDATE_MANIFEST_CHANNEL:-}" > "\${CAPTURE_FILE}"
`,
  )

  const env = {
    ...process.env,
    AGENT_DATA_DIR: agentDataDir,
    CAPTURE_FILE: captureFile,
    PATH: [mockNodeDir, process.env.PATH ?? ''].filter(Boolean).join(path.delimiter),
  }

  if (agentUpdateManifestChannel === undefined) {
    delete env.AGENT_UPDATE_MANIFEST_CHANNEL
  } else {
    env.AGENT_UPDATE_MANIFEST_CHANNEL = agentUpdateManifestChannel
  }

  const result = spawnSync('bash', [launcherPath], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
  })

  return {
    result,
    capturedChannel: fs.readFileSync(captureFile, 'utf8'),
  }
}

describe('run-linux launcher', () => {
  it('defaults AGENT_UPDATE_MANIFEST_CHANNEL to stable', () => {
    const { result, capturedChannel } = runLauncher()

    expect(result.status).toBe(0)
    expect(capturedChannel).toBe('stable')
  })

  it('respects explicit AGENT_UPDATE_MANIFEST_CHANNEL overrides', () => {
    const { result, capturedChannel } = runLauncher('disabled')

    expect(result.status).toBe(0)
    expect(capturedChannel).toBe('disabled')
  })
})
