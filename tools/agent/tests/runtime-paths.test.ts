import path from 'node:path'

import {
  resolveAgentDataDirFrom,
  resolveAgentPublicStateDirFrom,
} from '@tools/agent/runtime/paths'
import { describe, expect, it } from 'vitest'

describe('runtime path abstraction', () => {
  it('uses AGENT_DATA_DIR override when provided', () => {
    const result = resolveAgentDataDirFrom({
      env: {
        AGENT_DATA_DIR: '/tmp/custom-agent-data',
      },
      platform: 'linux',
      cwd: '/workspace',
      resolvePlatformDataDir() {
        return '/unused'
      },
      canUseLinuxSystemDir() {
        return false
      },
    })

    expect(result).toBe('/tmp/custom-agent-data')
  })

  it('uses Linux system directory when writable', () => {
    const result = resolveAgentDataDirFrom({
      env: {},
      platform: 'linux',
      cwd: '/workspace',
      resolvePlatformDataDir() {
        return '/unused'
      },
      canUseLinuxSystemDir() {
        return true
      },
    })

    expect(result).toBe('/var/lib/container-tracker-agent')
  })

  it('falls back to .agent-runtime when Linux system directory is not writable', () => {
    const result = resolveAgentDataDirFrom({
      env: {},
      platform: 'linux',
      cwd: '/workspace',
      resolvePlatformDataDir() {
        return '/unused'
      },
      canUseLinuxSystemDir() {
        return false
      },
    })

    expect(result).toBe(path.resolve('/workspace', '.agent-runtime'))
  })

  it('uses platform adapter outside Linux when no override is provided', () => {
    const result = resolveAgentDataDirFrom({
      env: {},
      platform: 'win32',
      cwd: '/workspace',
      resolvePlatformDataDir() {
        return 'C:\\AgentData'
      },
      canUseLinuxSystemDir() {
        return false
      },
    })

    expect(result).toBe('C:\\AgentData')
  })

  it('uses AGENT_PUBLIC_STATE_DIR override when provided', () => {
    const result = resolveAgentPublicStateDirFrom({
      env: {
        AGENT_PUBLIC_STATE_DIR: '/tmp/custom-agent-run',
      },
      platform: 'linux',
      resolveAgentDataDir() {
        return '/unused'
      },
    })

    expect(result).toBe('/tmp/custom-agent-run')
  })

  it('uses Linux public run directory when data dir is the installed system path', () => {
    const result = resolveAgentPublicStateDirFrom({
      env: {},
      platform: 'linux',
      resolveAgentDataDir() {
        return '/var/lib/container-tracker-agent'
      },
    })

    expect(result).toBe('/run/container-tracker-agent')
  })

  it('uses dataDir/run when Linux is running from a local agent runtime', () => {
    const result = resolveAgentPublicStateDirFrom({
      env: {},
      platform: 'linux',
      resolveAgentDataDir() {
        return path.resolve('/workspace', '.agent-runtime')
      },
    })

    expect(result).toBe(path.resolve('/workspace', '.agent-runtime', 'run'))
  })
})
