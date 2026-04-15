import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const launcherPath = path.join(repoRoot, 'scripts', 'agent', 'run-linux-with-control-ui.sh')
const runtimeLauncherPath = path.join(repoRoot, 'scripts', 'agent', 'run-linux.sh')

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function writeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, contents, 'utf8')
  fs.chmodSync(filePath, 0o755)
}

function writeMockCommands(binDir) {
  writeExecutable(
    path.join(binDir, 'bash'),
    `#!/bin/bash
set -euo pipefail

if [ "\${1:-}" = "\${EXPECTED_RUNTIME_SCRIPT:-}" ]; then
  printf '%s\\n' "\${AGENT_DATA_DIR:-}|\${DOTENV_PATH:-}|\${BOOTSTRAP_DOTENV_PATH:-}|\${AGENT_DISABLE_AUTOMATIC_UPDATE_CHECKS:-}" > "\${RUNTIME_ENV_CAPTURE_PATH}"
  printf 'runtime-start\\n' >> "\${EVENTS_PATH}"

  if [ "\${MOCK_RUNTIME_MODE:-short}" = "long" ]; then
    on_runtime_term() {
      printf 'runtime-sigterm\\n' >> "\${EVENTS_PATH}"
      exit 0
    }
    trap on_runtime_term TERM INT
    while :; do sleep 0.05; done
  fi

  sleep "\${MOCK_RUNTIME_SLEEP_SEC:-0.2}"
  printf 'runtime-exit\\n' >> "\${EVENTS_PATH}"
  exit "\${MOCK_RUNTIME_EXIT_CODE:-0}"
fi

exec /bin/bash "$@"
`,
  )

  writeExecutable(
    path.join(binDir, 'pnpm'),
    `#!/bin/bash
set -euo pipefail
printf '%s\\n' "$*" >> "\${UI_ARGS_CAPTURE_PATH}"
printf '%s\\n' "\${AGENT_DATA_DIR:-}|\${DOTENV_PATH:-}|\${BOOTSTRAP_DOTENV_PATH:-}|\${CT_AGENT_UI_INSTALLED:-}|\${CT_AGENT_UI_MODE:-}|\${CT_AGENT_UI_DISABLE_SINGLE_INSTANCE_LOCK:-}|\${CT_AGENT_UI_USER_DATA_DIR:-}" > "\${UI_ENV_CAPTURE_PATH}"
printf 'ui-start\\n' >> "\${EVENTS_PATH}"

mode="\${MOCK_UI_MODE:-fail}"
if [ "$mode" = "fail" ]; then
  printf 'ui-exit:5\\n' >> "\${EVENTS_PATH}"
  exit 5
fi

if [ "$mode" = "close" ]; then
  sleep "\${MOCK_UI_SLEEP_SEC:-0.05}"
  printf 'ui-exit:0\\n' >> "\${EVENTS_PATH}"
  exit 0
fi

on_ui_term() {
  printf 'ui-sigterm\\n' >> "\${EVENTS_PATH}"
  exit 0
}
trap on_ui_term TERM INT

while :; do sleep 0.05; done
`,
  )
}

function createHarness(command = {}) {
  const tempDir = makeTempDir('run-linux-with-ui-launcher-')
  const binDir = path.join(tempDir, 'bin')
  fs.mkdirSync(binDir, { recursive: true })
  writeMockCommands(binDir)

  const eventsPath = path.join(tempDir, 'events.log')
  const runtimeEnvCapturePath = path.join(tempDir, 'runtime-env.log')
  const uiEnvCapturePath = path.join(tempDir, 'ui-env.log')
  const uiArgsCapturePath = path.join(tempDir, 'ui-args.log')
  const agentDataDir = path.join(tempDir, 'agent-data')

  fs.writeFileSync(eventsPath, '', 'utf8')

  const env = {
    ...process.env,
    PATH: [binDir, process.env.PATH ?? ''].filter(Boolean).join(path.delimiter),
    EXPECTED_RUNTIME_SCRIPT: runtimeLauncherPath,
    EVENTS_PATH: eventsPath,
    RUNTIME_ENV_CAPTURE_PATH: runtimeEnvCapturePath,
    UI_ENV_CAPTURE_PATH: uiEnvCapturePath,
    UI_ARGS_CAPTURE_PATH: uiArgsCapturePath,
    AGENT_DATA_DIR: agentDataDir,
    AGENT_DISABLE_AUTOMATIC_UPDATE_CHECKS:
      command.disableAutomaticUpdateChecks ??
      process.env.AGENT_DISABLE_AUTOMATIC_UPDATE_CHECKS ??
      '1',
    CT_AGENT_UI_INSTALLED: command.uiInstalledEnv ?? '1',
    CT_AGENT_UI_MODE: command.uiModeEnv ?? 'tray',
    MOCK_RUNTIME_MODE: command.runtimeMode ?? 'short',
    MOCK_RUNTIME_SLEEP_SEC: String(command.runtimeSleepSec ?? 0.2),
    MOCK_RUNTIME_EXIT_CODE: String(command.runtimeExitCode ?? 0),
    MOCK_UI_MODE: command.uiMode ?? 'fail',
    MOCK_UI_SLEEP_SEC: String(command.uiSleepSec ?? 0.05),
  }

  return {
    tempDir,
    env,
    eventsPath,
    runtimeEnvCapturePath,
    uiEnvCapturePath,
    uiArgsCapturePath,
    agentDataDir,
  }
}

function readLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return []
  }
  const content = fs.readFileSync(filePath, 'utf8').trim()
  if (content.length === 0) {
    return []
  }
  return content.split('\n')
}

function runLauncherSync(command = {}) {
  const harness = createHarness(command)
  const result = spawnSync('/bin/bash', [launcherPath], {
    cwd: repoRoot,
    env: harness.env,
    encoding: 'utf8',
  })
  return {
    ...harness,
    result,
  }
}

async function waitForEvents(command) {
  const timeoutMs = command.timeoutMs ?? 4000
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const lines = readLines(command.eventsPath)
    const hasAll = command.expected.every((token) => lines.includes(token))
    if (hasAll) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  throw new Error(`Timed out waiting for events: ${command.expected.join(', ')}`)
}

async function waitForExit(child, timeoutMs = 4000) {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Timed out waiting for child process exit'))
    }, timeoutMs)

    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })

    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      resolve({ code, signal })
    })
  })
}

describe('run-linux-with-control-ui launcher', () => {
  it('keeps runtime as main process when UI fails and keeps shared .agent-runtime env', () => {
    const { result, runtimeEnvCapturePath, uiEnvCapturePath, uiArgsCapturePath, agentDataDir } =
      runLauncherSync({
        runtimeExitCode: 7,
        runtimeSleepSec: 0.2,
        uiMode: 'fail',
      })

    const expectedDotenvPath = path.join(agentDataDir, 'config.env')
    const expectedBootstrapPath = path.join(agentDataDir, 'bootstrap.env')
    const expectedControlUiUserDataDir = path.join(agentDataDir, 'control-ui-user-data')

    expect(result.status).toBe(7)
    expect(result.stderr).toContain('control UI exited with code 5')
    expect(fs.readFileSync(runtimeEnvCapturePath, 'utf8').trim()).toBe(
      `${agentDataDir}|${expectedDotenvPath}|${expectedBootstrapPath}|1`,
    )
    expect(fs.readFileSync(uiEnvCapturePath, 'utf8').trim()).toBe(
      `${agentDataDir}|${expectedDotenvPath}|${expectedBootstrapPath}|0|window|1|${expectedControlUiUserDataDir}`,
    )
    expect(fs.readFileSync(uiArgsCapturePath, 'utf8')).toContain(
      '--filter @container-tracker/agent run control-ui:start',
    )
  })

  it('does not stop runtime when the UI closes early', () => {
    const { result } = runLauncherSync({
      runtimeExitCode: 0,
      runtimeSleepSec: 0.2,
      uiMode: 'close',
      uiSleepSec: 0.05,
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('control UI closed; runtime continues')
  })

  it('forwards TERM cleanup to runtime and UI child', async () => {
    const harness = createHarness({
      runtimeMode: 'long',
      uiMode: 'long',
    })

    const child = spawn('/bin/bash', [launcherPath], {
      cwd: repoRoot,
      env: harness.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    try {
      await waitForEvents({
        eventsPath: harness.eventsPath,
        expected: ['runtime-start', 'ui-start'],
      })

      child.kill('SIGTERM')
      const { code, signal } = await waitForExit(child)
      const events = readLines(harness.eventsPath)

      expect(signal).toBeNull()
      expect([0, 143]).toContain(code)
      expect(events).toContain('runtime-sigterm')
      expect(events).toContain('ui-sigterm')
    } finally {
      child.kill('SIGKILL')
    }
  })
})
