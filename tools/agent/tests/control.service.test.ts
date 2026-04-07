import { createControlCommand } from '@tools/agent/control/control.commands'
import { createControlService } from '@tools/agent/control/control.service'
import { describe, expect, it, vi } from 'vitest'

function createSnapshot(version: string) {
  return {
    runtime: {
      status: 'RUNNING' as const,
      health: 'HEALTHY' as const,
      lastHeartbeatAt: '2026-04-06T20:00:00.000Z',
      activeJobs: 0,
    },
    release: {
      current: version,
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

type CreateControlServiceCommand = Parameters<typeof createControlService>[0]
type MockLocalService = NonNullable<CreateControlServiceCommand['localService']>

function createMockLocalService(): MockLocalService {
  const initialSnapshot = createSnapshot('1.0.0')
  const refreshedSnapshot = createSnapshot('2.0.0')

  return {
    getAgentOperationalSnapshot: vi
      .fn()
      .mockResolvedValueOnce({
        snapshot: refreshedSnapshot,
      })
      .mockResolvedValue({
        snapshot: initialSnapshot,
      }),
    getBackendState: vi.fn().mockReturnValue({
      backendUrl: 'https://backend.test.local',
      source: 'RUNTIME_CONFIG' as const,
      status: 'ENROLLED' as const,
      runtimeConfigAvailable: true,
      bootstrapConfigAvailable: true,
      installerTokenAvailable: true,
      publicStateAvailable: true,
      warnings: [],
    }),
    getLogs: vi.fn().mockResolvedValue({ lines: [] }),
    getReleaseInventory: vi.fn().mockReturnValue({ releases: [] }),
    getPaths: vi.fn().mockReturnValue({
      dataDir: '/tmp/agent',
      configPath: '/tmp/agent/config.env',
      releasesDir: '/tmp/agent/releases',
      logsDir: '/tmp/agent/logs',
      releaseStatePath: '/tmp/agent/release-state.json',
      runtimeHealthPath: '/tmp/agent/runtime-health.json',
      supervisorControlPath: '/tmp/agent/supervisor-control.json',
      controlOverridesPath: '/tmp/agent/control-overrides.local.json',
      controlRemoteCachePath: '/tmp/agent/control-remote-cache.json',
      infraConfigPath: '/tmp/agent/infra-config.json',
      auditLogPath: '/tmp/agent/agent-control-audit.ndjson',
    }),
    startAgent: vi
      .fn()
      .mockResolvedValue({ ok: true as const, message: 'started', snapshot: initialSnapshot }),
    stopAgent: vi
      .fn()
      .mockResolvedValue({ ok: true as const, message: 'stopped', snapshot: initialSnapshot }),
    restartAgent: vi
      .fn()
      .mockResolvedValue({ ok: true as const, message: 'restarted', snapshot: initialSnapshot }),
    pauseUpdates: vi
      .fn()
      .mockResolvedValue({ ok: true as const, message: 'paused', snapshot: initialSnapshot }),
    resumeUpdates: vi
      .fn()
      .mockResolvedValue({ ok: true as const, message: 'resumed', snapshot: initialSnapshot }),
    changeChannel: vi.fn().mockResolvedValue({
      ok: true as const,
      message: 'channel updated',
      snapshot: initialSnapshot,
    }),
    setBlockedVersions: vi.fn().mockResolvedValue({
      ok: true as const,
      message: 'blocked versions updated',
      snapshot: initialSnapshot,
    }),
    updateConfig: vi.fn().mockResolvedValue({
      ok: true as const,
      message: 'config updated',
      snapshot: initialSnapshot,
    }),
    setBackendUrl: vi.fn().mockResolvedValue({
      ok: true as const,
      message: 'backend updated',
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
    activateRelease: vi.fn().mockResolvedValue({
      ok: true as const,
      message: 'release activated',
      snapshot: initialSnapshot,
    }),
    rollbackRelease: vi.fn().mockResolvedValue({
      ok: true as const,
      message: 'rollback executed',
      snapshot: initialSnapshot,
    }),
    executeLocalReset: vi.fn().mockResolvedValue({
      ok: true as const,
      message: 'reset executed',
      snapshot: initialSnapshot,
    }),
  }
}

describe('control service dispatch', () => {
  it('dispatches lifecycle commands through the canonical control contract', async () => {
    const localService = createMockLocalService()
    const service = createControlService({
      layout: {
        dataDir: '/tmp/agent',
        configPath: '/tmp/agent/config.env',
        baseRuntimeConfigPath: '/tmp/agent/control-base.runtime.json',
        bootstrapPath: '/tmp/agent/bootstrap.env',
        consumedBootstrapPath: '/tmp/agent/bootstrap.env.consumed',
        releasesDir: '/tmp/agent/releases',
        downloadsDir: '/tmp/agent/downloads',
        logsDir: '/tmp/agent/logs',
        currentLinkPath: '/tmp/agent/current',
        previousLinkPath: '/tmp/agent/previous',
        releaseStatePath: '/tmp/agent/release-state.json',
        runtimeHealthPath: '/tmp/agent/runtime-health.json',
        supervisorControlPath: '/tmp/agent/supervisor-control.json',
        pendingActivityPath: '/tmp/agent/pending-activity-events.json',
        controlOverridesPath: '/tmp/agent/control-overrides.local.json',
        controlRemoteCachePath: '/tmp/agent/control-remote-cache.json',
        infraConfigPath: '/tmp/agent/infra-config.json',
        auditLogPath: '/tmp/agent/agent-control-audit.ndjson',
      },
      localService,
    })

    const result = await service.dispatch(
      createControlCommand({
        id: '7d9fd037-47d7-4740-8ec5-9481ce4f3300',
        requestedAt: '2026-04-06T20:00:00.000Z',
        type: 'restart-agent',
        payload: {},
      }),
    )

    expect(result.commandId).toBe('7d9fd037-47d7-4740-8ec5-9481ce4f3300')
    expect(result.status).toBe('completed')
    expect(result.message).toBe('restarted')
    expect(result.snapshot.release.current).toBe('1.0.0')
    expect(localService.restartAgent).toHaveBeenCalledOnce()
  })

  it('refreshes the canonical snapshot after backend URL changes', async () => {
    const localService = createMockLocalService()
    const service = createControlService({
      layout: {
        dataDir: '/tmp/agent',
        configPath: '/tmp/agent/config.env',
        baseRuntimeConfigPath: '/tmp/agent/control-base.runtime.json',
        bootstrapPath: '/tmp/agent/bootstrap.env',
        consumedBootstrapPath: '/tmp/agent/bootstrap.env.consumed',
        releasesDir: '/tmp/agent/releases',
        downloadsDir: '/tmp/agent/downloads',
        logsDir: '/tmp/agent/logs',
        currentLinkPath: '/tmp/agent/current',
        previousLinkPath: '/tmp/agent/previous',
        releaseStatePath: '/tmp/agent/release-state.json',
        runtimeHealthPath: '/tmp/agent/runtime-health.json',
        supervisorControlPath: '/tmp/agent/supervisor-control.json',
        pendingActivityPath: '/tmp/agent/pending-activity-events.json',
        controlOverridesPath: '/tmp/agent/control-overrides.local.json',
        controlRemoteCachePath: '/tmp/agent/control-remote-cache.json',
        infraConfigPath: '/tmp/agent/infra-config.json',
        auditLogPath: '/tmp/agent/agent-control-audit.ndjson',
      },
      localService,
    })

    const result = await service.dispatch(
      createControlCommand({
        id: '5b39ec4c-dcf5-4a58-8a1f-18d95f7f0f07',
        requestedAt: '2026-04-06T20:00:00.000Z',
        type: 'set-backend-url',
        payload: {
          backendUrl: 'https://backend.changed.local',
        },
      }),
    )

    expect(result.message).toBe('backend updated')
    expect(result.snapshot.release.current).toBe('2.0.0')
    expect(localService.setBackendUrl).toHaveBeenCalledWith('https://backend.changed.local')
    expect(localService.getAgentOperationalSnapshot).toHaveBeenCalled()
  })
})
