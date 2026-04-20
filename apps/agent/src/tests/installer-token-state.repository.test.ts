import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  clearInstallerTokenState,
  readInstallerTokenState,
  readInstallerTokenValue,
  writeInstallerTokenState,
} from '@agent/config/infrastructure/installer-token-state.repository'
import { resolveAgentPathLayoutPaths } from '@agent/platform/agent-path-layout'
import { describe, expect, it } from 'vitest'

function createLayout(baseDir: string) {
  return resolveAgentPathLayoutPaths({
    dataDir: baseDir,
    joinPath: path.join,
  })
}

describe('installer token state repository', () => {
  it('writes and reads installer token state from canonical state file', () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-installer-token-state-'))
    const layout = createLayout(dataDir)

    const written = writeInstallerTokenState({
      paths: layout,
      installerToken: 'installer-token-persisted',
    })

    const state = readInstallerTokenState({ paths: layout })
    const token = readInstallerTokenValue({ paths: layout })

    expect(state).not.toBeNull()
    expect(state?.installerToken).toBe('installer-token-persisted')
    expect(state?.updatedAt).toBe(written.updatedAt)
    expect(token).toBe('installer-token-persisted')
  })

  it('clears persisted installer token state', () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-installer-token-state-clear-'))
    const layout = createLayout(dataDir)

    writeInstallerTokenState({
      paths: layout,
      installerToken: 'installer-token-persisted',
    })
    clearInstallerTokenState({ paths: layout })

    expect(fs.existsSync(layout.installerTokenStatePath)).toBe(false)
    expect(readInstallerTokenState({ paths: layout })).toBeNull()
    expect(readInstallerTokenValue({ paths: layout })).toBeNull()
  })
})
