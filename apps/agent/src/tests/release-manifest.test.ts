import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  compareVersions,
  fetchManifest,
  selectPlatformAsset,
} from '@agent/release/release-manifest'
import { describe, expect, it } from 'vitest'

function createManifestDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-release-manifest-'))
}

describe('release manifest', () => {
  it('compares semantic versions deterministically', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1)
    expect(compareVersions('2.0.0-beta.1', '2.0.0')).toBe(-1)
    expect(compareVersions('2.0.0-beta.2', '2.0.0-beta.1')).toBe(1)
  })

  it('parses unified manifest and selects platform asset', async () => {
    const manifestsDir = createManifestDir()
    fs.writeFileSync(
      path.join(manifestsDir, 'stable.json'),
      `${JSON.stringify(
        {
          channel: 'stable',
          version: '2.0.0',
          platforms: {
            'linux-x64': {
              url: 'https://example.com/agent/stable/2.0.0/agent-linux-x64.tar.gz',
              checksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            },
            'windows-x64': {
              url: 'https://example.com/agent/stable/2.0.0/agent-windows-x64.zip',
              checksum: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            },
          },
          published_at: '2026-03-09T10:00:00.000Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    )

    const manifest = await fetchManifest('stable', { manifestsDir })
    const asset = selectPlatformAsset({
      manifest,
      platform: 'windows-x64',
    })

    expect(manifest.version).toBe('2.0.0')
    expect(asset.url).toContain('agent-windows-x64.zip')
  })

  it('keeps legacy manifest compatibility', async () => {
    const manifestsDir = createManifestDir()
    fs.writeFileSync(
      path.join(manifestsDir, 'canary.json'),
      `${JSON.stringify(
        {
          channel: 'canary',
          version: '1.9.0',
          download_url: 'https://example.com/agent/canary/1.9.0/agent-linux-x64.tar.gz',
          checksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          published_at: '2026-03-09T10:00:00.000Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    )

    const manifest = await fetchManifest('canary', { manifestsDir })
    const linuxAsset = selectPlatformAsset({
      manifest,
      platform: 'linux-x64',
    })
    const windowsAsset = selectPlatformAsset({
      manifest,
      platform: 'windows-x64',
    })

    expect(linuxAsset.url).toBe(windowsAsset.url)
    expect(linuxAsset.checksum).toBe(windowsAsset.checksum)
  })
})
