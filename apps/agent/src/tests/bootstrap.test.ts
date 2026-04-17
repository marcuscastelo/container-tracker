import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { createAgentRuntimeBootstrap } from '@agent/bootstrap/create-agent-runtime'
import { createBootstrapControlService } from '@agent/bootstrap/create-control-service'
import { createPlatformAdapter } from '@agent/bootstrap/create-platform-adapter'
import { afterEach, describe, expect, it } from 'vitest'

const ORIGINAL_AGENT_DATA_DIR = process.env.AGENT_DATA_DIR

afterEach(() => {
  if (typeof ORIGINAL_AGENT_DATA_DIR === 'string') {
    process.env.AGENT_DATA_DIR = ORIGINAL_AGENT_DATA_DIR
    return
  }

  delete process.env.AGENT_DATA_DIR
})

describe('agent bootstrap factories', () => {
  it('creates the canonical runtime layout and directories', () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bootstrap-layout-'))
    process.env.AGENT_DATA_DIR = dataDir

    const { layout } = createAgentRuntimeBootstrap()

    expect(layout.dataDir).toBe(dataDir)
    expect(fs.existsSync(layout.releasesDir)).toBe(true)
    expect(fs.existsSync(layout.downloadsDir)).toBe(true)
    expect(fs.existsSync(layout.logsDir)).toBe(true)
  })

  it('selects the platform adapter from the bootstrap factory', () => {
    expect(createPlatformAdapter({ platform: 'linux', arch: 'x64' }).key).toBe('linux-x64')
    expect(createPlatformAdapter({ platform: 'win32', arch: 'x64' }).key).toBe('windows-x64')
  })

  it('creates a bootstrap control service with canonical dispatch support', () => {
    process.env.AGENT_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bootstrap-control-'))

    const service = createBootstrapControlService()

    expect(typeof service.dispatch).toBe('function')
    expect(typeof service.getAgentOperationalSnapshot).toBe('function')
  })
})
