import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createInstalledLinuxControlService } from '@agent/electron/main/installed-linux-control-service'
import { afterEach, describe, expect, it } from 'vitest'

const ORIGINAL_AGENT_DATA_DIR = process.env.AGENT_DATA_DIR
const ORIGINAL_AGENT_PUBLIC_STATE_DIR = process.env.AGENT_PUBLIC_STATE_DIR

afterEach(() => {
  if (typeof ORIGINAL_AGENT_DATA_DIR === 'string') {
    process.env.AGENT_DATA_DIR = ORIGINAL_AGENT_DATA_DIR
  } else {
    delete process.env.AGENT_DATA_DIR
  }

  if (typeof ORIGINAL_AGENT_PUBLIC_STATE_DIR === 'string') {
    process.env.AGENT_PUBLIC_STATE_DIR = ORIGINAL_AGENT_PUBLIC_STATE_DIR
  } else {
    delete process.env.AGENT_PUBLIC_STATE_DIR
  }
})

describe('installed linux control service public-state paths', () => {
  it('falls back to the installed layout publicStateDir when AGENT_PUBLIC_STATE_DIR is not set', async () => {
    const dataDir = path.join(os.tmpdir(), `ct-agent-installed-layout-${Date.now()}`)
    process.env.AGENT_DATA_DIR = dataDir
    delete process.env.AGENT_PUBLIC_STATE_DIR

    const service = createInstalledLinuxControlService()

    await expect(service.getSnapshot()).rejects.toThrow(
      `Agent public state unavailable at ${path.join(dataDir, 'run', 'control-ui-state.json')}.`,
    )
  })

  it('uses AGENT_PUBLIC_STATE_DIR when explicitly provided', async () => {
    const dataDir = path.join(os.tmpdir(), `ct-agent-installed-layout-${Date.now()}`)
    const publicStateDir = path.join(os.tmpdir(), `ct-agent-public-state-${Date.now()}`)
    process.env.AGENT_DATA_DIR = dataDir
    process.env.AGENT_PUBLIC_STATE_DIR = publicStateDir

    const service = createInstalledLinuxControlService()

    await expect(service.getSnapshot()).rejects.toThrow(
      `Agent public state unavailable at ${path.join(publicStateDir, 'control-ui-state.json')}.`,
    )
  })

  it('prefers backend state embedded in public snapshot when backend-state artifact is stale', async () => {
    const dataDir = path.join(os.tmpdir(), `ct-agent-installed-layout-${Date.now()}`)
    const publicStateDir = path.join(os.tmpdir(), `ct-agent-public-state-${Date.now()}`)
    process.env.AGENT_DATA_DIR = dataDir
    process.env.AGENT_PUBLIC_STATE_DIR = publicStateDir
    fs.mkdirSync(publicStateDir, { recursive: true })

    fs.writeFileSync(
      path.join(publicStateDir, 'control-ui-backend-state.json'),
      `${JSON.stringify(
        {
          backendUrl: 'https://bootstrap.test.local',
          source: 'BOOTSTRAP',
          status: 'BOOTSTRAP_ONLY',
          runtimeConfigAvailable: false,
          bootstrapConfigAvailable: true,
          installerTokenAvailable: true,
          publicStateAvailable: false,
          warnings: [],
        },
        null,
        2,
      )}\n`,
      'utf8',
    )

    fs.writeFileSync(
      path.join(publicStateDir, 'control-ui-state.json'),
      `${JSON.stringify(
        {
          snapshot: {
            runtime: {
              status: 'RUNNING',
              health: 'HEALTHY',
              lastHeartbeatAt: '2026-04-15T16:56:41.204Z',
              activeJobs: 0,
            },
            release: {
              current: '0.3.0',
              previous: null,
              target: null,
            },
            updates: {
              paused: {
                value: false,
                source: 'BASE',
                overridden: [],
              },
              channel: {
                value: 'stable',
                source: 'BASE',
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
                LIMIT: '10',
              },
              requiresRestart: [],
            },
            infra: {
              supabaseUrl: 'https://infra.test.local',
              source: 'REMOTE',
            },
          },
          releaseInventory: {
            releases: [],
          },
          paths: {
            dataDir: '/tmp/agent',
            configEnvPath: '/tmp/agent/config.env',
            releasesDir: '/tmp/agent/releases',
            logsDir: '/tmp/agent/logs',
            releaseStatePath: '/tmp/agent/release-state.json',
            runtimeStatePath: '/tmp/agent/runtime-state.json',
            supervisorControlPath: '/tmp/agent/supervisor-control.json',
            controlOverridesPath: '/tmp/agent/control-overrides.local.json',
            controlRemoteCachePath: '/tmp/agent/control-remote-cache.json',
            infraConfigPath: '/tmp/agent/infra-config.json',
            auditLogPath: '/tmp/agent/agent-control-audit.ndjson',
          },
          backendState: {
            backendUrl: 'https://backend.enrolled.local',
            source: 'RUNTIME_CONFIG',
            status: 'ENROLLED',
            runtimeConfigAvailable: true,
            bootstrapConfigAvailable: true,
            installerTokenAvailable: true,
            publicStateAvailable: true,
            warnings: [],
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    )

    const service = createInstalledLinuxControlService()
    const backendState = await service.getBackendState()

    expect(backendState.status).toBe('ENROLLED')
    expect(backendState.source).toBe('RUNTIME_CONFIG')
    expect(backendState.publicStateAvailable).toBe(true)
    expect(backendState.backendUrl).toBe('https://backend.enrolled.local')
  })
})
