import path from 'node:path'

import { resolveAgentPathLayoutPaths } from '@agent/platform/agent-path-layout'
import { linuxPlatformAdapter } from '@agent/platform/linux.adapter'
import { windowsPlatformAdapter } from '@agent/platform/windows.adapter'
import { describe, expect, it } from 'vitest'

describe('platform adapters path layout integration', () => {
  it('matches Linux adapter path resolution with canonical shared layout defaults', () => {
    const dataDir = '/tmp/agent-layout-linux'
    const paths = linuxPlatformAdapter.resolvePaths({
      env: {
        AGENT_DATA_DIR: dataDir,
      },
      cwd: '/workspace',
    })

    const expected = resolveAgentPathLayoutPaths({
      dataDir,
      joinPath: path.join,
    })

    expect(paths).toEqual(expected)
  })

  it('matches Linux adapter path resolution with canonical shared layout env overrides', () => {
    const dataDir = '/tmp/agent-layout-linux-custom'
    const paths = linuxPlatformAdapter.resolvePaths({
      env: {
        AGENT_DATA_DIR: dataDir,
        BOOTSTRAP_DOTENV_PATH: '/etc/agent/bootstrap.override.env',
        DOTENV_PATH: '/etc/agent/config.override.env',
        AGENT_PUBLIC_STATE_DIR: '/srv/agent/public',
      },
      cwd: '/workspace',
    })

    const expected = resolveAgentPathLayoutPaths({
      dataDir,
      bootstrapEnvPath: '/etc/agent/bootstrap.override.env',
      configEnvPath: '/etc/agent/config.override.env',
      publicStateDir: '/srv/agent/public',
      joinPath: path.join,
    })

    expect(paths).toEqual(expected)
  })

  it('matches Windows adapter path resolution with canonical shared layout defaults', () => {
    const localAppData = 'C:\\Users\\Agent\\AppData\\Local'
    const dataDir = path.win32.join(localAppData, 'ContainerTracker')
    const paths = windowsPlatformAdapter.resolvePaths({
      env: {
        LOCALAPPDATA: localAppData,
      },
    })

    const expected = resolveAgentPathLayoutPaths({
      dataDir,
      joinPath: path.win32.join,
    })

    expect(paths).toEqual(expected)
  })

  it('matches Windows adapter path resolution with canonical shared layout env overrides', () => {
    const dataDir = 'D:\\AgentData'
    const paths = windowsPlatformAdapter.resolvePaths({
      env: {
        AGENT_DATA_DIR: dataDir,
        BOOTSTRAP_DOTENV_PATH: 'D:\\AgentData\\env\\bootstrap.override.env',
        DOTENV_PATH: 'D:\\AgentData\\env\\config.override.env',
        AGENT_PUBLIC_STATE_DIR: 'D:\\AgentData\\public-state',
      },
    })

    const expected = resolveAgentPathLayoutPaths({
      dataDir,
      bootstrapEnvPath: 'D:\\AgentData\\env\\bootstrap.override.env',
      configEnvPath: 'D:\\AgentData\\env\\config.override.env',
      publicStateDir: 'D:\\AgentData\\public-state',
      joinPath: path.win32.join,
    })

    expect(paths).toEqual(expected)
  })
})
