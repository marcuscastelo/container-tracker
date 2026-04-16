import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { createLinuxDevProcessControlStrategy } from '@agent/platform/control/linux-dev-process-control'
import { createLinuxServiceControlStrategy } from '@agent/platform/control/linux-service-control'
import {
  buildWindowsTaskEndCommand,
  buildWindowsTaskRunCommand,
  createWindowsTaskControlStrategy,
} from '@agent/platform/control/windows-task-control'
import { afterEach, describe, expect, it, vi } from 'vitest'

function createTempDataDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
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

describe('windows task control strategy', () => {
  it('executes start/stop/restart through scheduled-task commands', async () => {
    const runCommand = vi.fn().mockResolvedValue({ stdout: '', stderr: '' })
    const strategy = createWindowsTaskControlStrategy({ runCommand })

    await strategy.startAgent({ serviceName: 'CustomTask' })
    await strategy.stopAgent({ serviceName: 'CustomTask' })
    await strategy.restartAgent({ serviceName: 'CustomTask' })

    expect(runCommand).toHaveBeenNthCalledWith(1, 'cmd.exe', [
      '/d',
      '/s',
      '/c',
      buildWindowsTaskRunCommand('CustomTask'),
    ])
    expect(runCommand).toHaveBeenNthCalledWith(2, 'cmd.exe', [
      '/d',
      '/s',
      '/c',
      buildWindowsTaskEndCommand('CustomTask'),
    ])
    expect(runCommand).toHaveBeenNthCalledWith(3, 'cmd.exe', [
      '/d',
      '/s',
      '/c',
      buildWindowsTaskEndCommand('CustomTask'),
    ])
    expect(runCommand).toHaveBeenNthCalledWith(4, 'cmd.exe', [
      '/d',
      '/s',
      '/c',
      buildWindowsTaskRunCommand('CustomTask'),
    ])
  })
})
