import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { createLinuxDevProcessControlStrategy } from '@agent/platform/control/linux-dev-process-control'
import { createLinuxServiceControlStrategy } from '@agent/platform/control/linux-service-control'
import { createWindowsProcessControlStrategy } from '@agent/platform/control/windows-process-control'
import type { PlatformPathResolution } from '@agent/platform/platform.contract'
import { afterEach, describe, expect, it, vi } from 'vitest'

function createTempDataDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function createWindowsControlPaths(dataDir: string): {
  readonly layout: PlatformPathResolution
  readonly installRoot: string
  readonly startupExecutablePath: string
  readonly supervisorPidPath: string
  readonly runtimeStatePath: string
  readonly supervisorControlPath: string
} {
  const layout: PlatformPathResolution = {
    dataDir,
    releasesDir: path.join(dataDir, 'releases'),
    currentPath: path.join(dataDir, 'current'),
    previousPath: path.join(dataDir, 'previous'),
    logsDir: path.join(dataDir, 'logs'),
    releaseStatePath: path.join(dataDir, 'release-state.json'),
    runtimeStatePath: path.join(dataDir, 'runtime-state.json'),
    configEnvPath: path.join(dataDir, 'config.env'),
    bootstrapEnvPath: path.join(dataDir, 'bootstrap.env'),
    consumedBootstrapEnvPath: path.join(dataDir, 'bootstrap.env.consumed'),
    installerTokenStatePath: path.join(dataDir, 'installer-token-state.json'),
    downloadsDir: path.join(dataDir, 'downloads'),
    baseRuntimeConfigPath: path.join(dataDir, 'control-base.runtime.json'),
    supervisorControlPath: path.join(dataDir, 'supervisor-control.json'),
    pendingActivityPath: path.join(dataDir, 'pending-activity-events.json'),
    controlOverridesPath: path.join(dataDir, 'control-overrides.local.json'),
    controlRemoteCachePath: path.join(dataDir, 'control-remote-cache.json'),
    infraConfigPath: path.join(dataDir, 'infra-config.json'),
    auditLogPath: path.join(dataDir, 'agent-control-audit.ndjson'),
    publicStateDir: path.join(dataDir, 'run'),
    publicStatePath: path.join(dataDir, 'run', 'control-ui-state.json'),
    publicBackendStatePath: path.join(dataDir, 'run', 'control-ui-backend-state.json'),
    publicLogsPath: path.join(dataDir, 'run', 'control-ui-logs.json'),
    agentLogForwarderStatePath: path.join(dataDir, 'agent-log-forwarder-state.json'),
  }

  return {
    layout,
    installRoot: path.join(dataDir, 'Programs', 'ContainerTrackerAgent'),
    startupExecutablePath: path.join(
      dataDir,
      'Programs',
      'ContainerTrackerAgent',
      'ct-agent-startup.exe',
    ),
    supervisorPidPath: path.join(dataDir, 'supervisor.pid'),
    runtimeStatePath: layout.runtimeStatePath,
    supervisorControlPath: layout.supervisorControlPath,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('linux service control strategy', () => {
  it('executes start/stop/restart through systemctl with resolved service name', async () => {
    const runCommand = vi.fn().mockResolvedValue({ stdout: '', stderr: '' })
    const strategy = createLinuxServiceControlStrategy({
      env: {
        AGENT_SERVICE_NAME: 'agent-from-env',
      },
      runCommand,
    })

    await strategy.startAgent()
    await strategy.stopAgent({ serviceName: 'manual-name' })
    await strategy.restartAgent()

    expect(runCommand).toHaveBeenNthCalledWith(1, 'systemctl', ['start', 'agent-from-env'])
    expect(runCommand).toHaveBeenNthCalledWith(2, 'systemctl', ['stop', 'manual-name'])
    expect(runCommand).toHaveBeenNthCalledWith(3, 'systemctl', ['restart', 'agent-from-env'])
  })
})

describe('linux dev process control strategy', () => {
  it('starts the local supervisor when no running pid is found', async () => {
    const dataDir = createTempDataDir('agent-local-control-start-')
    const startSupervisor = vi.fn()

    const strategy = createLinuxDevProcessControlStrategy({
      env: {
        AGENT_DATA_DIR: dataDir,
      },
      resolveEffectiveSupervisorPid: async () => null,
      startSupervisor,
    })

    await strategy.startAgent()

    expect(startSupervisor).toHaveBeenCalledTimes(1)
    expect(startSupervisor).toHaveBeenCalledWith({
      dataDir,
      dotenvPath: path.join(dataDir, 'config.env'),
      bootstrapPath: path.join(dataDir, 'bootstrap.env'),
    })
  })

  it('stops and restarts an existing local supervisor via kill and control file request', async () => {
    const dataDir = createTempDataDir('agent-local-control-restart-')
    const resolveEffectiveSupervisorPid = vi
      .fn<() => Promise<number | null>>()
      .mockResolvedValue(31337)
    const killProcess = vi.fn()
    const waitForProcessExit = vi
      .fn<(pid: number, timeoutMs: number) => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    const cleanupSupervisorPidFile = vi.fn()
    const requestRestart = vi.fn()

    const strategy = createLinuxDevProcessControlStrategy({
      env: {
        AGENT_DATA_DIR: dataDir,
      },
      resolveEffectiveSupervisorPid,
      killProcess,
      waitForProcessExit,
      cleanupSupervisorPidFile,
      requestRestart,
    })

    await strategy.stopAgent()
    await strategy.restartAgent()

    expect(killProcess).toHaveBeenNthCalledWith(1, 31337, 'SIGTERM')
    expect(killProcess).toHaveBeenNthCalledWith(2, 31337, 'SIGKILL')
    expect(waitForProcessExit).toHaveBeenNthCalledWith(1, 31337, 5000)
    expect(waitForProcessExit).toHaveBeenNthCalledWith(2, 31337, 1000)
    expect(cleanupSupervisorPidFile).toHaveBeenCalledWith(path.join(dataDir, 'supervisor.pid'))
    expect(requestRestart).toHaveBeenCalledWith(path.join(dataDir, 'supervisor-control.json'))
  })
})

describe('windows process control strategy', () => {
  it('starts the native startup launcher when no supervisor pid is alive', async () => {
    const dataDir = createTempDataDir('agent-windows-control-start-')
    const paths = createWindowsControlPaths(dataDir)
    const startStartup = vi.fn()
    const strategy = createWindowsProcessControlStrategy({
      resolvePaths: () => paths,
      resolveSupervisorPid: async () => null,
      startStartup,
    })

    await strategy.startAgent()

    expect(startStartup).toHaveBeenCalledWith({
      startupExecutablePath: paths.startupExecutablePath,
      installRoot: paths.installRoot,
      layout: paths.layout,
      runtimeOnly: true,
    })
  })

  it('requests supervisor drain for restart when the supervisor is running', async () => {
    const dataDir = createTempDataDir('agent-windows-control-restart-')
    const paths = createWindowsControlPaths(dataDir)
    const requestRestart = vi.fn()
    const strategy = createWindowsProcessControlStrategy({
      resolvePaths: () => paths,
      resolveSupervisorPid: async () => 4242,
      requestRestart,
    })

    await strategy.restartAgent()

    expect(requestRestart).toHaveBeenCalledWith(paths.supervisorControlPath)
  })

  it('stops a running supervisor and cleans stale pid state', async () => {
    const dataDir = createTempDataDir('agent-windows-control-stop-')
    const paths = createWindowsControlPaths(dataDir)
    const killProcess = vi.fn()
    const waitForProcessExit = vi
      .fn<(pid: number, timeoutMs: number) => Promise<boolean>>()
      .mockResolvedValue(true)
    const cleanupSupervisorPidFile = vi.fn()
    const strategy = createWindowsProcessControlStrategy({
      resolvePaths: () => paths,
      resolveSupervisorPid: async () => 4242,
      killProcess,
      waitForProcessExit,
      cleanupSupervisorPidFile,
    })

    await strategy.stopAgent()

    expect(killProcess).toHaveBeenCalledWith(4242, 'SIGTERM')
    expect(waitForProcessExit).toHaveBeenCalledWith(4242, 5000)
    expect(cleanupSupervisorPidFile).toHaveBeenCalledWith(paths.supervisorPidPath)
  })
})
