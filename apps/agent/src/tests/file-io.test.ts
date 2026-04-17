import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { writeFileAtomic } from '@agent/state/file-io'
import { afterEach, describe, expect, it, vi } from 'vitest'

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-file-io-'))
}

function withPlatform<T>(platform: NodeJS.Platform, run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')
  Object.defineProperty(process, 'platform', {
    configurable: true,
    enumerable: true,
    value: platform,
    writable: false,
  })

  try {
    return run()
  } finally {
    if (descriptor) {
      Object.defineProperty(process, 'platform', descriptor)
    }
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('writeFileAtomic', () => {
  it('writes a new file', () => {
    const dir = createTempDir()
    const filePath = path.join(dir, 'state.json')

    writeFileAtomic(filePath, 'hello')

    expect(fs.readFileSync(filePath, 'utf8')).toBe('hello')
  })

  it('overwrites an existing file', () => {
    const dir = createTempDir()
    const filePath = path.join(dir, 'state.json')
    fs.writeFileSync(filePath, 'old', 'utf8')

    writeFileAtomic(filePath, 'new')

    expect(fs.readFileSync(filePath, 'utf8')).toBe('new')
  })

  it('cleans up temporary file when replace fails', () => {
    const dir = createTempDir()
    const filePath = path.join(dir, 'state.json')
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('rename failed')
    })

    expect(() => writeFileAtomic(filePath, 'content')).toThrow('rename failed')
    expect(renameSpy).toHaveBeenCalledTimes(1)

    const residualTempFiles = fs
      .readdirSync(dir)
      .filter((entry) => entry.startsWith('state.json.tmp-'))
    expect(residualTempFiles).toHaveLength(0)
  })

  it('uses deterministic replace flow on windows when target exists', () => {
    const dir = createTempDir()
    const filePath = path.join(dir, 'state.json')
    fs.writeFileSync(filePath, 'old-content', 'utf8')

    const rmSpy = vi.spyOn(fs, 'rmSync')

    withPlatform('win32', () => {
      writeFileAtomic(filePath, 'new-content')
    })

    expect(rmSpy).toHaveBeenCalledWith(filePath, { force: true })
    expect(fs.readFileSync(filePath, 'utf8')).toBe('new-content')
  })
})
