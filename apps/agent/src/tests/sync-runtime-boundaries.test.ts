import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function readRuntimeEntrySource(): string {
  const runtimeEntryPath = path.join(
    process.cwd(),
    'apps',
    'agent',
    'src',
    'runtime',
    'runtime.entry.ts',
  )
  return fs.readFileSync(runtimeEntryPath, 'utf8')
}

describe('sync/runtime boundaries', () => {
  it('runtime entry does not import carrier fetchers directly', () => {
    const source = readRuntimeEntrySource()

    const forbiddenPatterns = [
      '/tracking/infrastructure/carriers/fetchers/',
      'fetchMscStatus',
      'fetchCmaCgmStatus',
      'fetchPilStatus',
      'fetchOneStatus',
      'createMaerskCaptureService',
    ]

    const violations = forbiddenPatterns.filter((pattern) => source.includes(pattern))
    expect(violations).toEqual([])
  })

  it('runtime entry does not branch by provider carrier-specific conditions', () => {
    const source = readRuntimeEntrySource()

    const forbiddenPatterns = [
      "providerInput.provider === 'msc'",
      "providerInput.provider === 'cmacgm'",
      "providerInput.provider === 'pil'",
      "providerInput.provider === 'one'",
      "providerInput.provider === 'maersk'",
    ]

    const violations = forbiddenPatterns.filter((pattern) => source.includes(pattern))
    expect(violations).toEqual([])
  })
})
