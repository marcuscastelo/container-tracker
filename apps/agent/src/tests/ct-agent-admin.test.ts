import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { CtAgentAdminService } from '@agent/cli/ct-agent-admin'
import { runCtAgentAdmin } from '@agent/cli/ct-agent-admin'
import { EXIT_FATAL, EXIT_OK } from '@agent/runtime/lifecycle-exit-codes'
import { afterEach, describe, expect, it } from 'vitest'

const ORIGINAL_AGENT_PUBLIC_STATE_DIR = process.env.AGENT_PUBLIC_STATE_DIR

function createSnapshot() {
  return {
    runtime: {
      status: 'RUNNING' as const,
      health: 'HEALTHY' as const,
      lastHeartbeatAt: '2026-04-05T12:00:00.000Z',
      activeJobs: 0,
    },
    release: {
      current: '1.0.0',
      previous: null,
      target: null,
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
        LIMIT: '10',
      },
      requiresRestart: [],
    },
    infra: {
      supabaseUrl: 'https://backend.test.local',
      source: 'FALLBACK' as const,
    },
  }
}

function createMockService(command?: {
  readonly logsMessage?: string
  readonly commandMessage?: string
}): CtAgentAdminService {
  const snapshot = createSnapshot()
  const commandMessage = command?.commandMessage ?? 'ok'

  return {
    getAgentOperationalSnapshot: async () => ({
      baseConfig: {
        AGENT_ID: 'agent-1',
        AGENT_TOKEN: 'secret-token',
        AGENT_UPDATE_MANIFEST_CHANNEL: 'stable',
        BACKEND_URL: 'https://backend.test.local',
        INTERVAL_SEC: 60,
        LIMIT: 10,
        MAERSK_ENABLED: false,
        MAERSK_HEADLESS: true,
        MAERSK_TIMEOUT_MS: 120000,
        MAERSK_USER_DATA_DIR: null,
        SUPABASE_ANON_KEY: null,
        SUPABASE_URL: null,
        TENANT_ID: '00000000-0000-4000-8000-000000000001',
      },
      effectiveConfig: {
        AGENT_ID: 'agent-1',
        AGENT_TOKEN: 'secret-token',
        AGENT_UPDATE_MANIFEST_CHANNEL: 'stable',
        BACKEND_URL: 'https://backend.test.local',
        INTERVAL_SEC: 60,
        LIMIT: 10,
        MAERSK_ENABLED: false,
        MAERSK_HEADLESS: true,
        MAERSK_TIMEOUT_MS: 120000,
        MAERSK_USER_DATA_DIR: null,
        SUPABASE_ANON_KEY: null,
        SUPABASE_URL: null,
        TENANT_ID: '00000000-0000-4000-8000-000000000001',
      },
      localOverrides: {
        updatesPaused: null,
        channel: null,
        blockedVersions: [],
        editableConfig: {},
      },
      remotePolicy: {
        desiredVersion: null,
        updateChannel: null,
        updatesPaused: false,
        blockedVersions: [],
        restartRequestedAt: null,
      },
      remoteCommands: [],
      releaseState: {
        current_version: '1.0.0',
        previous_version: null,
        target_version: null,
        last_known_good_version: '1.0.0',
        blocked_versions: [],
        activation_state: 'idle',
        automatic_updates_blocked: false,
        last_update_attempt: null,
        last_error: null,
      },
      runtimeHealth: null,
      snapshot,
    }),
    getLogs: async () => ({
      lines: [
        {
          channel: 'stdout' as const,
          message: command?.logsMessage ?? 'log-line',
          filePath: '/var/lib/container-tracker-agent/logs/agent.out.log',
          lineNumber: 1,
        },
      ],
    }),
    getBackendState: () => ({
      backendUrl: 'https://backend.test.local',
      source: 'RUNTIME_CONFIG' as const,
      status: 'ENROLLED' as const,
      runtimeConfigAvailable: true,
      bootstrapConfigAvailable: true,
      installerTokenAvailable: true,
      publicStateAvailable: true,
      warnings: [],
    }),
    getReleaseInventory: () => ({
      releases: [
        {
          version: '1.0.0',
          isCurrent: true,
          isPrevious: false,
          isTarget: false,
          entrypointPath: '/var/lib/container-tracker-agent/releases/1.0.0/agent.js',
        },
      ],
    }),
    getPaths: () => ({
      dataDir: '/var/lib/container-tracker-agent',
      configEnvPath: '/var/lib/container-tracker-agent/config.env',
      releasesDir: '/var/lib/container-tracker-agent/releases',
      logsDir: '/var/lib/container-tracker-agent/logs',
      releaseStatePath: '/var/lib/container-tracker-agent/release-state.json',
      runtimeStatePath: '/var/lib/container-tracker-agent/runtime-state.json',
      supervisorControlPath: '/var/lib/container-tracker-agent/supervisor-control.json',
      controlOverridesPath: '/var/lib/container-tracker-agent/control-overrides.local.json',
      controlRemoteCachePath: '/var/lib/container-tracker-agent/control-remote-cache.json',
      infraConfigPath: '/var/lib/container-tracker-agent/infra-config.json',
      auditLogPath: '/var/lib/container-tracker-agent/agent-control-audit.ndjson',
    }),
    startAgent: async () => ({ ok: true as const, message: commandMessage, snapshot }),
    stopAgent: async () => ({ ok: true as const, message: commandMessage, snapshot }),
    restartAgent: async () => ({ ok: true as const, message: commandMessage, snapshot }),
    pauseUpdates: async () => ({ ok: true as const, message: commandMessage, snapshot }),
    resumeUpdates: async () => ({ ok: true as const, message: commandMessage, snapshot }),
    changeChannel: async () => ({ ok: true as const, message: commandMessage, snapshot }),
    setBlockedVersions: async () => ({ ok: true as const, message: commandMessage, snapshot }),
    updateConfig: async () => ({ ok: true as const, message: commandMessage, snapshot }),
    setBackendUrl: async () => ({
      ok: true as const,
      message: commandMessage,
      state: {
        backendUrl: 'https://backend.changed.local',
        source: 'BOOTSTRAP' as const,
        status: 'BOOTSTRAP_ONLY' as const,
        runtimeConfigAvailable: false,
        bootstrapConfigAvailable: true,
        installerTokenAvailable: true,
        publicStateAvailable: false,
        warnings: [],
      },
    }),
    activateRelease: async () => ({ ok: true as const, message: commandMessage, snapshot }),
    rollbackRelease: async () => ({ ok: true as const, message: commandMessage, snapshot }),
    executeLocalReset: async () => ({ ok: true as const, message: commandMessage, snapshot }),
  }
}

afterEach(() => {
  if (typeof ORIGINAL_AGENT_PUBLIC_STATE_DIR === 'string') {
    process.env.AGENT_PUBLIC_STATE_DIR = ORIGINAL_AGENT_PUBLIC_STATE_DIR
  } else {
    delete process.env.AGENT_PUBLIC_STATE_DIR
  }
})

describe('ct-agent-admin CLI', () => {
  it('executes a privileged command and persists the refreshed public state', async () => {
    const publicStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-agent-admin-public-state-'))
    process.env.AGENT_PUBLIC_STATE_DIR = publicStateDir
    const outputs: string[] = []

    const exitCode = await runCtAgentAdmin({
      argv: ['node', 'ct-agent-admin', 'start-agent'],
      deps: {
        service: createMockService({
          commandMessage: 'started',
        }),
        print(value) {
          outputs.push(value)
        },
      },
    })

    const publicStatePath = path.join(publicStateDir, 'control-ui-state.json')
    const rawState = fs.readFileSync(publicStatePath, 'utf8')

    expect(exitCode).toBe(EXIT_OK)
    expect(outputs.join('\n')).toContain('"message": "started"')
    expect(rawState).toContain('"releaseInventory"')
    expect(rawState).not.toContain('secret-token')
  })

  it('returns logs JSON for get-logs', async () => {
    const outputs: string[] = []

    const exitCode = await runCtAgentAdmin({
      argv: ['node', 'ct-agent-admin', 'get-logs', '{"channel":"all","tail":50}'],
      deps: {
        service: createMockService({
          logsMessage: 'tail-line',
        }),
        print(value) {
          outputs.push(value)
        },
      },
    })

    expect(exitCode).toBe(EXIT_OK)
    expect(outputs.join('\n')).toContain('tail-line')
  })

  it('returns backend state JSON for get-backend-state', async () => {
    const outputs: string[] = []

    const exitCode = await runCtAgentAdmin({
      argv: ['node', 'ct-agent-admin', 'get-backend-state'],
      deps: {
        service: createMockService(),
        print(value) {
          outputs.push(value)
        },
      },
    })

    expect(exitCode).toBe(EXIT_OK)
    expect(outputs.join('\n')).toContain('"backendUrl": "https://backend.test.local"')
    expect(outputs.join('\n')).toContain('"status": "ENROLLED"')
  })

  it('fails when a JSON payload is invalid', async () => {
    const errors: string[] = []

    const exitCode = await runCtAgentAdmin({
      argv: ['node', 'ct-agent-admin', 'change-channel', '{invalid-json}'],
      deps: {
        service: createMockService(),
        printError(value) {
          errors.push(value)
        },
      },
    })

    expect(exitCode).toBe(EXIT_FATAL)
    expect(errors.join('\n')).toContain('JSON')
  })

  it('returns backend update JSON for set-backend-url', async () => {
    const outputs: string[] = []
    const publicStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-agent-admin-backend-state-'))
    process.env.AGENT_PUBLIC_STATE_DIR = publicStateDir

    const exitCode = await runCtAgentAdmin({
      argv: ['node', 'ct-agent-admin', 'set-backend-url', '{"backendUrl":"https://next.test"}'],
      deps: {
        service: createMockService({
          commandMessage: 'backend changed',
        }),
        print(value) {
          outputs.push(value)
        },
      },
    })

    expect(exitCode).toBe(EXIT_OK)
    expect(outputs.join('\n')).toContain('"message": "backend changed"')
    expect(outputs.join('\n')).toContain('"backendUrl": "https://backend.changed.local"')

    const backendStatePath = path.join(publicStateDir, 'control-ui-backend-state.json')
    const backendStateRaw = fs.readFileSync(backendStatePath, 'utf8')
    expect(backendStateRaw).toContain('"backendUrl": "https://backend.changed.local"')
  })
})
