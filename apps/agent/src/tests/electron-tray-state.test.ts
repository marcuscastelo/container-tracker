import type {
  AgentControlBackendState,
  AgentControlPaths,
  AgentOperationalSnapshot,
  AgentReleaseInventory,
} from '@agent/control-core/contracts'
import { mapAgentTrayState } from '@agent/electron/main/tray/tray-state'
import { describe, expect, it } from 'vitest'

function createSnapshot(
  overrides?: Partial<AgentOperationalSnapshot['runtime']> & {
    readonly targetVersion?: string | null
  },
): AgentOperationalSnapshot {
  return {
    runtime: {
      status: overrides?.status ?? 'RUNNING',
      health: overrides?.health ?? 'HEALTHY',
      lastHeartbeatAt: overrides?.lastHeartbeatAt ?? '2026-04-15T16:56:41.204Z',
      activeJobs: overrides?.activeJobs ?? 0,
    },
    release: {
      current: '1.0.0',
      previous: null,
      target: overrides?.targetVersion ?? null,
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
      editable: {},
      requiresRestart: [],
    },
    infra: {
      supabaseUrl: 'https://infra.test.local',
      source: 'REMOTE',
    },
  }
}

function createBackendState(status: AgentControlBackendState['status']): AgentControlBackendState {
  return {
    backendUrl: status === 'ENROLLED' ? 'https://agent.test.local' : null,
    source: status === 'ENROLLED' ? 'RUNTIME_CONFIG' : 'NONE',
    status,
    runtimeConfigAvailable: status === 'ENROLLED',
    bootstrapConfigAvailable: true,
    installerTokenAvailable: true,
    publicStateAvailable: true,
    warnings: [],
  }
}

function createPaths(): AgentControlPaths {
  return {
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
  }
}

function createReleaseInventory(): AgentReleaseInventory {
  return {
    releases: [
      {
        version: '1.0.0',
        isCurrent: true,
        isPrevious: false,
        isTarget: false,
        entrypointPath: '/tmp/agent/releases/1.0.0/agent.js',
      },
    ],
  }
}

describe('Electron tray state mapper', () => {
  it('maps healthy runtime state to a healthy tray icon and enabled operations', () => {
    const vm = mapAgentTrayState({
      snapshot: createSnapshot(),
      backendState: createBackendState('ENROLLED'),
      releaseInventory: createReleaseInventory(),
      paths: createPaths(),
      commandInFlight: false,
      lastErrorSummary: null,
    })

    expect(vm.iconVariant).toBe('healthy')
    expect(vm.tooltip).toBe('Container Tracker - connected')
    expect(vm.menuItems).toContainEqual({
      kind: 'item',
      id: 'check-for-updates',
      label: 'Check for updates',
      enabled: true,
      action: 'check-for-updates',
    })
  })

  it('maps degraded runtime state to a warning icon', () => {
    const vm = mapAgentTrayState({
      snapshot: createSnapshot({ health: 'DEGRADED' }),
      backendState: createBackendState('ENROLLED'),
      releaseInventory: createReleaseInventory(),
      paths: createPaths(),
      commandInFlight: false,
      lastErrorSummary: null,
    })

    expect(vm.iconVariant).toBe('warning')
  })

  it('maps missing snapshot to danger and disables operational paths', () => {
    const vm = mapAgentTrayState({
      snapshot: null,
      backendState: null,
      releaseInventory: null,
      paths: null,
      commandInFlight: false,
      lastErrorSummary: 'public state unavailable',
    })

    expect(vm.iconVariant).toBe('danger')
    expect(vm.balloon?.content).toBe('public state unavailable')
    expect(vm.menuItems).toContainEqual({
      kind: 'item',
      id: 'open-logs',
      label: 'Open logs folder',
      enabled: false,
      action: 'open-logs',
    })
  })

  it('maps target release and command activity to busy icon state', () => {
    const vm = mapAgentTrayState({
      snapshot: createSnapshot({ targetVersion: '1.1.0' }),
      backendState: createBackendState('ENROLLED'),
      releaseInventory: createReleaseInventory(),
      paths: createPaths(),
      commandInFlight: true,
      lastErrorSummary: null,
    })

    expect(vm.iconVariant).toBe('busy')
    expect(vm.menuItems).toContainEqual({
      kind: 'item',
      id: 'restart-agent',
      label: 'Restart agent runtime',
      enabled: false,
      action: 'restart-agent',
    })
  })
})
