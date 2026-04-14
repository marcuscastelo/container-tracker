import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  ControlRuntimeConfigSchema,
  executeLocalReset,
  syncAgentControlState,
} from '@agent/control-core/agent-control-core'
import {
  AgentControlRemoteCacheSchema,
  AgentInfraConfigCacheSchema,
  LocalOverrideStateSchema,
} from '@agent/control-core/contracts'
import { createAgentControlLocalService } from '@agent/control-core/local-control-service'
import { appendPendingActivityEvents } from '@agent/pending-activity'
import {
  createInitialReleaseState,
  readReleaseState,
  writeReleaseState,
} from '@agent/release-state'
import { writeRuntimeHealth } from '@agent/runtime-health'
import type { AgentPathLayout } from '@agent/runtime-paths'
import { readSupervisorControl } from '@agent/supervisor-control'
import { describe, expect, it } from 'vitest'

function createLayout(baseDir: string): AgentPathLayout {
  const layout: AgentPathLayout = {
    dataDir: baseDir,
    configPath: path.join(baseDir, 'config.env'),
    baseRuntimeConfigPath: path.join(baseDir, 'control-base.runtime.json'),
    bootstrapPath: path.join(baseDir, 'bootstrap.env'),
    consumedBootstrapPath: path.join(baseDir, 'bootstrap.env.consumed'),
    releasesDir: path.join(baseDir, 'releases'),
    downloadsDir: path.join(baseDir, 'downloads'),
    logsDir: path.join(baseDir, 'logs'),
    currentLinkPath: path.join(baseDir, 'current'),
    previousLinkPath: path.join(baseDir, 'previous'),
    releaseStatePath: path.join(baseDir, 'release-state.json'),
    runtimeHealthPath: path.join(baseDir, 'runtime-health.json'),
    supervisorControlPath: path.join(baseDir, 'supervisor-control.json'),
    pendingActivityPath: path.join(baseDir, 'pending-activity-events.json'),
    controlOverridesPath: path.join(baseDir, 'control-overrides.local.json'),
    controlRemoteCachePath: path.join(baseDir, 'control-remote-cache.json'),
    infraConfigPath: path.join(baseDir, 'infra-config.json'),
    auditLogPath: path.join(baseDir, 'agent-control-audit.ndjson'),
  }

  fs.mkdirSync(layout.releasesDir, { recursive: true })
  fs.mkdirSync(layout.downloadsDir, { recursive: true })
  fs.mkdirSync(layout.logsDir, { recursive: true })
  return layout
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function createControlRuntimeConfig(
  overrides?: Partial<ReturnType<typeof baseConfig>>,
): ReturnType<typeof baseConfig> {
  return {
    ...baseConfig(),
    ...overrides,
  }
}

function baseConfig() {
  return ControlRuntimeConfigSchema.parse({
    BACKEND_URL: 'https://backend.test.local',
    SUPABASE_URL: null,
    SUPABASE_ANON_KEY: null,
    AGENT_TOKEN: 'agent-token-test',
    TENANT_ID: '00000000-0000-4000-8000-000000000001',
    AGENT_ID: '11111111-1111-4111-8111-111111111111',
    INTERVAL_SEC: 60,
    LIMIT: 10,
    MAERSK_ENABLED: false,
    MAERSK_HEADLESS: true,
    MAERSK_TIMEOUT_MS: 120000,
    MAERSK_USER_DATA_DIR: null,
    AGENT_UPDATE_MANIFEST_CHANNEL: 'stable',
  })
}

function writeHealthyRuntime(layout: AgentPathLayout, version: string): void {
  writeRuntimeHealth(layout.runtimeHealthPath, {
    agent_version: version,
    boot_status: 'healthy',
    update_state: 'idle',
    last_heartbeat_at: '2026-04-04T12:00:00.000Z',
    last_heartbeat_ok_at: '2026-04-04T12:00:00.000Z',
    active_jobs: 2,
    processing_state: 'idle',
    updated_at: '2026-04-04T12:00:00.000Z',
    pid: 4242,
  })
}

function writeReleaseEntrypoint(layout: AgentPathLayout, version: string): void {
  const releaseDir = path.join(layout.releasesDir, version)
  fs.mkdirSync(releaseDir, { recursive: true })
  fs.writeFileSync(path.join(releaseDir, 'agent.js'), "console.log('ok')\n", 'utf8')
}

function recentFetchedAt(): string {
  return new Date().toISOString()
}

describe('agent control core', () => {
  it('resolves effective state with remote precedence and cached infra fallback', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-control-core-'))
    const layout = createLayout(tempDir)
    const config = createControlRuntimeConfig()

    writeJson(
      layout.controlOverridesPath,
      LocalOverrideStateSchema.parse({
        updatesPaused: false,
        channel: 'dev',
        blockedVersions: ['2.8.0'],
        editableConfig: {
          LIMIT: '25',
          MAERSK_HEADLESS: 'false',
        },
      }),
    )
    writeJson(
      layout.controlRemoteCachePath,
      AgentControlRemoteCacheSchema.parse({
        fetchedAt: recentFetchedAt(),
        state: {
          policy: {
            desiredVersion: '3.0.0',
            updateChannel: 'canary',
            updatesPaused: true,
            blockedVersions: ['2.9.0'],
            restartRequestedAt: null,
          },
          commands: [],
        },
      }),
    )
    writeJson(
      layout.infraConfigPath,
      AgentInfraConfigCacheSchema.parse({
        fetchedAt: recentFetchedAt(),
        config: {
          supabaseUrl: 'https://infra-cache.test.local',
          supabaseAnonKey: 'anon-cache',
        },
      }),
    )
    writeHealthyRuntime(layout, '1.0.0')
    writeReleaseState(layout.releaseStatePath, {
      ...createInitialReleaseState('1.0.0'),
      blocked_versions: ['2.7.0'],
    })

    const result = await syncAgentControlState({
      layout,
      currentConfig: config,
      forceRemoteFetch: false,
    })

    expect(result.snapshot.updates.paused.value).toBe(true)
    expect(result.snapshot.updates.paused.source).toBe('REMOTE_POLICY')
    expect(result.snapshot.updates.channel.value).toBe('canary')
    expect(result.snapshot.updates.channel.source).toBe('REMOTE_POLICY')
    expect(result.snapshot.updates.blockedVersions.local).toEqual(['2.7.0', '2.8.0'])
    expect(result.snapshot.updates.blockedVersions.remote).toEqual(['2.9.0'])
    expect(result.snapshot.updates.blockedVersions.effective).toEqual(['2.7.0', '2.8.0', '2.9.0'])
    expect(result.snapshot.infra.source).toBe('FALLBACK')

    const configEnv = fs.readFileSync(layout.configPath, 'utf8')
    expect(configEnv).toContain('AGENT_UPDATE_MANIFEST_CHANNEL=canary')
    expect(configEnv).toContain('SUPABASE_URL=https://infra-cache.test.local')
    expect(configEnv).toContain('LIMIT=25')
  })

  it('local reset clears local overrides and preserves remote policy state', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-control-reset-'))
    const layout = createLayout(tempDir)
    const config = createControlRuntimeConfig()

    writeJson(
      layout.controlOverridesPath,
      LocalOverrideStateSchema.parse({
        updatesPaused: true,
        channel: 'dev',
        blockedVersions: ['2.8.0'],
        editableConfig: {
          LIMIT: '25',
        },
      }),
    )
    writeJson(
      layout.controlRemoteCachePath,
      AgentControlRemoteCacheSchema.parse({
        fetchedAt: recentFetchedAt(),
        state: {
          policy: {
            desiredVersion: null,
            updateChannel: 'canary',
            updatesPaused: false,
            blockedVersions: ['2.9.0'],
            restartRequestedAt: null,
          },
          commands: [],
        },
      }),
    )
    writeHealthyRuntime(layout, '1.0.0')
    writeReleaseState(layout.releaseStatePath, {
      ...createInitialReleaseState('1.0.0'),
      blocked_versions: ['2.7.0'],
      target_version: '2.0.0',
      activation_state: 'pending',
      automatic_updates_blocked: true,
    })

    const result = await executeLocalReset({
      layout,
      currentConfig: config,
      source: 'LOCAL',
    })

    const overrides = JSON.parse(fs.readFileSync(layout.controlOverridesPath, 'utf8'))
    expect(overrides).toEqual({
      updatesPaused: null,
      channel: null,
      blockedVersions: [],
      editableConfig: {},
    })

    const releaseState = readReleaseState(layout.releaseStatePath, '1.0.0')
    expect(releaseState.blocked_versions).toEqual([])
    expect(releaseState.target_version).toBeNull()
    expect(releaseState.activation_state).toBe('idle')
    expect(releaseState.automatic_updates_blocked).toBe(false)
    expect(result.snapshot.updates.blockedVersions.local).toEqual([])
    expect(result.snapshot.updates.blockedVersions.remote).toEqual(['2.9.0'])
    expect(result.snapshot.updates.blockedVersions.effective).toEqual(['2.9.0'])

    const pendingActivity = JSON.parse(fs.readFileSync(layout.pendingActivityPath, 'utf8'))
    expect(pendingActivity).toHaveLength(1)
    expect(pendingActivity[0]?.type).toBe('LOCAL_RESET')
    expect(fs.readFileSync(layout.auditLogPath, 'utf8')).toContain('"type":"LOCAL_RESET"')
  })

  it('local control service activates a staged release through supervisor flow', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-control-service-'))
    const layout = createLayout(tempDir)
    const config = createControlRuntimeConfig()

    writeHealthyRuntime(layout, '1.0.0')
    writeReleaseState(layout.releaseStatePath, createInitialReleaseState('1.0.0'))
    writeReleaseEntrypoint(layout, '1.0.0')
    writeReleaseEntrypoint(layout, '2.0.0')
    appendPendingActivityEvents(layout.pendingActivityPath, [])
    writeJson(
      layout.infraConfigPath,
      AgentInfraConfigCacheSchema.parse({
        fetchedAt: recentFetchedAt(),
        config: {
          supabaseUrl: 'https://infra-cache.test.local',
          supabaseAnonKey: 'anon-cache',
        },
      }),
    )

    const adapterCalls = {
      started: 0,
      stopped: 0,
      restarted: 0,
    }

    const service = createAgentControlLocalService({
      layout,
      adapter: {
        key: 'linux',
        async startAgent() {
          adapterCalls.started += 1
        },
        async stopAgent() {
          adapterCalls.stopped += 1
        },
        async restartAgent() {
          adapterCalls.restarted += 1
        },
      },
    })

    await syncAgentControlState({
      layout,
      currentConfig: config,
      forceRemoteFetch: false,
    })

    const result = await service.activateRelease('2.0.0')

    const releaseState = readReleaseState(layout.releaseStatePath, '1.0.0')
    expect(releaseState.target_version).toBe('2.0.0')
    expect(releaseState.activation_state).toBe('pending')
    expect(readSupervisorControl(layout.supervisorControlPath)).toEqual({
      drain_requested: true,
      reason: 'update',
      requested_at: releaseState.last_update_attempt,
    })
    expect(result.snapshot.release.target).toBe('2.0.0')
    expect(result.message).toContain('2.0.0')
    expect(adapterCalls).toEqual({
      started: 0,
      stopped: 0,
      restarted: 0,
    })

    const inventory = service.getReleaseInventory()
    expect(inventory.releases.map((release) => release.version)).toEqual(['2.0.0', '1.0.0'])
    expect(inventory.releases[0]?.isTarget).toBe(true)
  })

  it('local control service reset orchestrates stop and start around baseline restore', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-control-service-reset-'))
    const layout = createLayout(tempDir)
    const config = createControlRuntimeConfig()

    writeHealthyRuntime(layout, '1.0.0')
    writeJson(
      layout.controlOverridesPath,
      LocalOverrideStateSchema.parse({
        updatesPaused: true,
        channel: 'dev',
        blockedVersions: ['2.8.0'],
        editableConfig: {
          LIMIT: '25',
        },
      }),
    )
    writeJson(
      layout.controlRemoteCachePath,
      AgentControlRemoteCacheSchema.parse({
        fetchedAt: recentFetchedAt(),
        state: {
          policy: {
            desiredVersion: null,
            updateChannel: null,
            updatesPaused: false,
            blockedVersions: [],
            restartRequestedAt: null,
          },
          commands: [],
        },
      }),
    )
    writeReleaseState(layout.releaseStatePath, createInitialReleaseState('1.0.0'))

    await syncAgentControlState({
      layout,
      currentConfig: config,
      forceRemoteFetch: false,
    })

    const adapterCalls = {
      started: 0,
      stopped: 0,
    }

    const service = createAgentControlLocalService({
      layout,
      adapter: {
        key: 'linux',
        async startAgent() {
          adapterCalls.started += 1
        },
        async stopAgent() {
          adapterCalls.stopped += 1
        },
        async restartAgent() {
          throw new Error('restart should not be called in local reset orchestration')
        },
      },
    })

    const result = await service.executeLocalReset()

    expect(adapterCalls).toEqual({
      started: 1,
      stopped: 1,
    })
    expect(result.snapshot.updates.channel.source).toBe('BASE')
    const overrides = JSON.parse(fs.readFileSync(layout.controlOverridesPath, 'utf8'))
    expect(overrides.blockedVersions).toEqual([])
    expect(overrides.editableConfig).toEqual({})
  })

  it('allows backend updates from bootstrap-only state and requests a restart', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-control-backend-bootstrap-'))
    const layout = createLayout(tempDir)
    fs.writeFileSync(
      layout.bootstrapPath,
      [
        'BACKEND_URL=http://localhost:3000/',
        'INSTALLER_TOKEN=installer-token-test',
        'AGENT_ID=container-tracker-agent',
        'INTERVAL_SEC=60',
        'LIMIT=10',
        'MAERSK_ENABLED=1',
        'MAERSK_HEADLESS=1',
        'MAERSK_TIMEOUT_MS=120000',
        '',
      ].join('\n'),
      'utf8',
    )

    let restartCalls = 0
    const service = createAgentControlLocalService({
      layout,
      adapter: {
        key: 'linux',
        async startAgent() {},
        async stopAgent() {},
        async restartAgent() {
          restartCalls += 1
        },
      },
    })

    expect(service.getBackendState()).toMatchObject({
      backendUrl: 'http://localhost:3000',
      source: 'BOOTSTRAP',
      status: 'BOOTSTRAP_ONLY',
      runtimeConfigAvailable: false,
      installerTokenAvailable: true,
    })

    const result = await service.setBackendUrl('https://backend.changed.local/')

    expect(restartCalls).toBe(1)
    expect(result.state.backendUrl).toBe('https://backend.changed.local')
    expect(result.state.source).toBe('BOOTSTRAP')
    expect(fs.readFileSync(layout.bootstrapPath, 'utf8')).toContain(
      'BACKEND_URL=https://backend.changed.local',
    )
  })

  it('ignores stale remote policy cache so local channel override can take effect', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-control-remote-cache-stale-'))
    const layout = createLayout(tempDir)
    const config = createControlRuntimeConfig()

    writeJson(
      layout.controlOverridesPath,
      LocalOverrideStateSchema.parse({
        updatesPaused: null,
        channel: 'canary',
        blockedVersions: [],
        editableConfig: {},
      }),
    )

    writeJson(
      layout.controlRemoteCachePath,
      AgentControlRemoteCacheSchema.parse({
        fetchedAt: '2000-01-01T00:00:00.000Z',
        state: {
          policy: {
            desiredVersion: null,
            updateChannel: 'stable',
            updatesPaused: false,
            blockedVersions: [],
            restartRequestedAt: null,
          },
          commands: [],
        },
      }),
    )

    const result = await syncAgentControlState({
      layout,
      currentConfig: config,
      forceRemoteFetch: false,
    })

    expect(result.snapshot.updates.channel.value).toBe('canary')
    expect(result.snapshot.updates.channel.source).toBe('LOCAL')
  })

  it('updates bootstrap backend URL without materializing config.env when only base config exists', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-control-backend-base-only-'))
    const layout = createLayout(tempDir)
    writeJson(layout.baseRuntimeConfigPath, createControlRuntimeConfig())
    writeJson(
      layout.controlRemoteCachePath,
      AgentControlRemoteCacheSchema.parse({
        fetchedAt: recentFetchedAt(),
        state: {
          policy: {
            desiredVersion: null,
            updateChannel: 'stable',
            updatesPaused: false,
            blockedVersions: [],
            restartRequestedAt: null,
          },
          commands: [],
        },
      }),
    )
    writeJson(
      layout.infraConfigPath,
      AgentInfraConfigCacheSchema.parse({
        fetchedAt: recentFetchedAt(),
        config: {
          supabaseUrl: 'https://infra-cache.test.local',
          supabaseAnonKey: 'anon-cache',
        },
      }),
    )
    fs.writeFileSync(
      layout.bootstrapPath,
      ['BACKEND_URL=http://localhost:3000/', 'INSTALLER_TOKEN=installer-token-test', ''].join('\n'),
      'utf8',
    )

    let restartCalls = 0
    const service = createAgentControlLocalService({
      layout,
      adapter: {
        key: 'linux',
        async startAgent() {},
        async stopAgent() {},
        async restartAgent() {
          restartCalls += 1
        },
      },
    })

    const result = await service.setBackendUrl('https://backend.changed.local/')

    expect(restartCalls).toBe(1)
    expect(result.state.backendUrl).toBe('https://backend.changed.local')
    expect(result.state.source).toBe('BOOTSTRAP')
    expect(fs.existsSync(layout.configPath)).toBe(false)
    expect(fs.existsSync(layout.controlRemoteCachePath)).toBe(false)
    expect(fs.existsSync(layout.infraConfigPath)).toBe(false)
    expect(fs.readFileSync(layout.bootstrapPath, 'utf8')).toContain(
      'BACKEND_URL=https://backend.changed.local',
    )
  })
})
