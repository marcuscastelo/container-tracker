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
})
