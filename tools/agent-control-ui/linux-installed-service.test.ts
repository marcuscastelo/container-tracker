import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { createInstalledLinuxControlService } from '@tools/agent-control-ui/linux-installed-service'
import { afterEach, describe, expect, it } from 'vitest'

const ORIGINAL_AGENT_PUBLIC_STATE_DIR = process.env.AGENT_PUBLIC_STATE_DIR
const ORIGINAL_AGENT_DATA_DIR = process.env.AGENT_DATA_DIR

function createSnapshot() {
  return {
    runtime: {
      status: 'RUNNING' as const,
      health: 'HEALTHY' as const,
      lastHeartbeatAt: '2026-04-06T18:24:00.326Z',
      activeJobs: 0,
    },
    release: {
      current: '0.3.0-alpha.1',
      previous: null,
      target: '0.3.0-alpha.1',
    },
    updates: {
      paused: {
        value: false,
        source: 'BASE' as const,
        overridden: [],
      },
      channel: {
        value: 'stable',
        source: 'BASE' as const,
        overridden: [],
      },
      blockedVersions: {
        local: [],
        remote: [],
        effective: [],
      },
      forceTargetVersion: null,
    },
    config: {
      editable: {
        INTERVAL_SEC: '60',
      },
      requiresRestart: [],
    },
    infra: {
      supabaseUrl: 'https://nwnprtgcjxzvvqpyqdrk.supabase.co',
      source: 'FALLBACK' as const,
    },
  }
}

afterEach(() => {
  if (typeof ORIGINAL_AGENT_PUBLIC_STATE_DIR === 'string') {
    process.env.AGENT_PUBLIC_STATE_DIR = ORIGINAL_AGENT_PUBLIC_STATE_DIR
  } else {
    delete process.env.AGENT_PUBLIC_STATE_DIR
  }

  if (typeof ORIGINAL_AGENT_DATA_DIR === 'string') {
    process.env.AGENT_DATA_DIR = ORIGINAL_AGENT_DATA_DIR
  } else {
    delete process.env.AGENT_DATA_DIR
  }
})

describe('installed Linux control service', () => {
  it('reads snapshot and backend state from the public run directory', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-ui-installed-data-'))
    const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-ui-installed-run-'))
    process.env.AGENT_DATA_DIR = dataDir
    process.env.AGENT_PUBLIC_STATE_DIR = publicDir

    const snapshot = createSnapshot()
    fs.writeFileSync(
      path.join(publicDir, 'control-ui-state.json'),
      `${JSON.stringify({
        snapshot,
        releaseInventory: {
          releases: [],
        },
        paths: {
          dataDir,
          configPath: path.join(dataDir, 'config.env'),
          releasesDir: path.join(dataDir, 'releases'),
          logsDir: path.join(dataDir, 'logs'),
          releaseStatePath: path.join(dataDir, 'release-state.json'),
          runtimeHealthPath: path.join(dataDir, 'runtime-health.json'),
          supervisorControlPath: path.join(dataDir, 'supervisor-control.json'),
          controlOverridesPath: path.join(dataDir, 'control-overrides.local.json'),
          controlRemoteCachePath: path.join(dataDir, 'control-remote-cache.json'),
          infraConfigPath: path.join(dataDir, 'infra-config.json'),
          auditLogPath: path.join(dataDir, 'agent-control-audit.ndjson'),
        },
        backendState: {
          backendUrl: 'http://localhost:3000',
          source: 'RUNTIME_CONFIG',
          status: 'ENROLLED',
          runtimeConfigAvailable: true,
          bootstrapConfigAvailable: true,
          installerTokenAvailable: true,
          publicStateAvailable: true,
          warnings: [],
        },
      }, null, 2)}\n`,
      'utf8',
    )
    fs.writeFileSync(
      path.join(publicDir, 'control-ui-backend-state.json'),
      `${JSON.stringify({
        backendUrl: 'http://localhost:3000',
        source: 'RUNTIME_CONFIG',
        status: 'ENROLLED',
        runtimeConfigAvailable: true,
        bootstrapConfigAvailable: true,
        installerTokenAvailable: true,
        publicStateAvailable: true,
        warnings: [],
      }, null, 2)}\n`,
      'utf8',
    )
    fs.writeFileSync(
      path.join(publicDir, 'control-ui-logs.json'),
      `${JSON.stringify({
        lines: [
          {
            channel: 'stdout',
            message: 'ready',
            filePath: path.join(dataDir, 'logs', 'agent.out.log'),
            lineNumber: 1,
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    )

    const service = createInstalledLinuxControlService()
    const resolvedSnapshot = await service.getSnapshot()
    const backendState = await service.getBackendState()
    const logs = await service.getLogs({ channel: 'all', tail: 200 })

    expect(resolvedSnapshot.runtime.status).toBe('RUNNING')
    expect(backendState.status).toBe('ENROLLED')
    expect(backendState.backendUrl).toBe('http://localhost:3000')
    expect(logs.lines).toHaveLength(1)
    expect(logs.lines[0]?.message).toBe('ready')
  })

  it('reports missing public state instead of touching private config files', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-ui-installed-data-'))
    const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-ui-installed-run-'))
    process.env.AGENT_DATA_DIR = dataDir
    process.env.AGENT_PUBLIC_STATE_DIR = publicDir

    const service = createInstalledLinuxControlService()

    await expect(service.getSnapshot()).rejects.toThrow(
      `Agent public state unavailable at ${path.join(publicDir, 'control-ui-state.json')}`,
    )
  })
})
