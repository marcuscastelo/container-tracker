import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runCtAgent } from '@agent/cli/ct-agent'
import { EXIT_CONFIG_ERROR, EXIT_FATAL, EXIT_OK } from '@agent/runtime/lifecycle-exit-codes'
import { afterEach, describe, expect, it } from 'vitest'

const ORIGINAL_AGENT_DATA_DIR = process.env.AGENT_DATA_DIR

function makeTempAgentDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ct-agent-cli-test-'))
}

function writeRuntimeHealthFile(baseDir: string): void {
  const runtimeHealthPath = path.join(baseDir, 'runtime-health.json')
  fs.mkdirSync(baseDir, { recursive: true })
  fs.writeFileSync(
    runtimeHealthPath,
    `${JSON.stringify(
      {
        agent_version: '1.0.0',
        boot_status: 'healthy',
        update_state: 'idle',
        last_heartbeat_at: new Date().toISOString(),
        last_heartbeat_ok_at: new Date().toISOString(),
        active_jobs: 0,
        processing_state: 'idle',
        updated_at: new Date().toISOString(),
        pid: 1234,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
}

afterEach(() => {
  if (typeof ORIGINAL_AGENT_DATA_DIR === 'string') {
    process.env.AGENT_DATA_DIR = ORIGINAL_AGENT_DATA_DIR
  } else {
    delete process.env.AGENT_DATA_DIR
  }
})

describe('ct-agent CLI', () => {
  it('dispatches status command and returns success when runtime health exists', async () => {
    const dataDir = makeTempAgentDataDir()
    process.env.AGENT_DATA_DIR = dataDir
    writeRuntimeHealthFile(dataDir)

    const exitCode = await runCtAgent({
      argv: ['node', 'ct-agent', 'status'],
    })

    expect(exitCode).toBe(EXIT_OK)
  })

  it('falls back from journalctl to local logs for logs command', async () => {
    const dataDir = makeTempAgentDataDir()
    process.env.AGENT_DATA_DIR = dataDir
    const logsDir = path.join(dataDir, 'logs')
    fs.mkdirSync(logsDir, { recursive: true })
    fs.writeFileSync(path.join(logsDir, 'supervisor.log'), 'log-line\n', 'utf8')

    const observedCalls: string[] = []
    const exitCode = await runCtAgent({
      argv: ['node', 'ct-agent', 'logs'],
      deps: {
        async runCommand(command): Promise<number> {
          observedCalls.push(command)
          if (command === 'journalctl') {
            return 1
          }
          if (command === 'tail') {
            return EXIT_OK
          }
          return EXIT_FATAL
        },
      },
    })

    expect(exitCode).toBe(EXIT_OK)
    expect(observedCalls).toEqual(['journalctl', 'tail'])
  })

  it('returns operational failure when restart command cannot call systemctl', async () => {
    const dataDir = makeTempAgentDataDir()
    process.env.AGENT_DATA_DIR = dataDir

    const exitCode = await runCtAgent({
      argv: ['node', 'ct-agent', 'restart'],
      deps: {
        async runCommand(): Promise<number> {
          throw new Error('systemctl not found')
        },
      },
    })

    expect(exitCode).toBe(EXIT_FATAL)
  })

  it('returns configuration error when enroll command has no bootstrap config', async () => {
    const dataDir = makeTempAgentDataDir()
    process.env.AGENT_DATA_DIR = dataDir

    const exitCode = await runCtAgent({
      argv: ['node', 'ct-agent', 'enroll'],
    })

    expect(exitCode).toBe(EXIT_CONFIG_ERROR)
  })
})
