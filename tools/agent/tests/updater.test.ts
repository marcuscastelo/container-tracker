import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { createInitialReleaseState } from '@tools/agent/release-state'
import type { AgentPathLayout } from '@tools/agent/runtime-paths'
import { fetchUpdateManifest, stageReleaseFromManifest } from '@tools/agent/updater.core'
import { describe, expect, it } from 'vitest'

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function createLayout(baseDir: string): AgentPathLayout {
  const layout: AgentPathLayout = {
    dataDir: baseDir,
    configPath: path.join(baseDir, 'config.env'),
    bootstrapPath: path.join(baseDir, 'bootstrap.env'),
    consumedBootstrapPath: path.join(baseDir, 'bootstrap.env.consumed'),
    releasesDir: path.join(baseDir, 'releases'),
    downloadsDir: path.join(baseDir, 'downloads'),
    logsDir: path.join(baseDir, 'logs'),
    currentLinkPath: path.join(baseDir, 'current'),
    previousLinkPath: path.join(baseDir, 'previous'),
    releaseStatePath: path.join(baseDir, 'release-state.json'),
    runtimeHealthPath: path.join(baseDir, 'runtime-health.json'),
    supervisorControlPath: path.join(baseDir, 'supervisor-control.json'),
    pendingActivityPath: path.join(baseDir, 'pending-activity-events.json'),
  }

  fs.mkdirSync(layout.releasesDir, { recursive: true })
  fs.mkdirSync(layout.downloadsDir, { recursive: true })
  fs.mkdirSync(layout.logsDir, { recursive: true })
  return layout
}

describe('updater core', () => {
  it('parses update manifest payload', async () => {
    const checksum = sha256("console.log('agent v2')\n")

    const fetchManifest = async (input: string | URL | Request): Promise<Response> => {
      const url = String(input)
      if (url.endsWith('/api/agent/update-manifest')) {
        return new Response(
          JSON.stringify({
            version: '2.0.0',
            download_url: 'https://example.com/agent-v2.js',
            checksum,
            channel: 'stable',
            update_available: true,
            desired_version: '2.0.0',
            current_version: '1.0.0',
            update_ready_version: null,
            restart_required: false,
            restart_requested_at: null,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }

      return new Response(JSON.stringify({ error: 'not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })
    }

    const manifest = await fetchUpdateManifest(
      {
        backendUrl: 'https://agent.test.local',
        agentToken: 'tok_test',
        agentId: 'agent-test',
      },
      fetchManifest,
    )

    expect(manifest.version).toBe('2.0.0')
    expect(manifest.channel).toBe('stable')
    expect(manifest.update_available).toBe(true)
  })

  it('treats 204 response as no update available', async () => {
    const fetchManifest = async (): Promise<Response> => {
      return new Response(null, { status: 204 })
    }

    const manifest = await fetchUpdateManifest(
      {
        backendUrl: 'https://agent.test.local',
        agentToken: 'tok_test',
        agentId: 'agent-test',
      },
      fetchManifest,
    )

    expect(manifest.update_available).toBe(false)
    expect(manifest.download_url).toBeNull()
    expect(manifest.channel).toBe('stable')
  })

  it('stages release download and validates checksum', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-updater-test-'))
    const layout = createLayout(tempDir)
    const releaseBody = "console.log('agent v2')\n"
    const checksum = sha256(releaseBody)

    const fetchRelease = async (): Promise<Response> =>
      new Response(releaseBody, {
        status: 200,
        headers: { 'content-type': 'application/javascript' },
      })

    const result = await stageReleaseFromManifest({
      manifest: {
        version: '2.0.0',
        download_url: 'https://agent.test.local/release-v2.js',
        checksum,
        channel: 'stable',
        update_available: true,
        desired_version: '2.0.0',
        current_version: '1.0.0',
        update_ready_version: null,
        restart_required: false,
        restart_requested_at: null,
      },
      layout,
      state: createInitialReleaseState('1.0.0'),
      fetchImpl: fetchRelease,
    })

    expect(result.kind).toBe('staged')
    if (result.kind !== 'staged') return
    expect(result.downloaded).toBe(true)
    expect(fs.existsSync(path.join(result.releaseDir, 'agent.js'))).toBe(true)
  })

  it('fails when checksum does not match downloaded release', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-updater-test-'))
    const layout = createLayout(tempDir)
    const releaseBody = "console.log('agent bad checksum')\n"

    const fetchRelease = async (): Promise<Response> =>
      new Response(releaseBody, {
        status: 200,
        headers: { 'content-type': 'application/javascript' },
      })

    await expect(
      stageReleaseFromManifest({
        manifest: {
          version: '2.0.1',
          download_url: 'https://agent.test.local/release-bad.js',
          checksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          channel: 'stable',
          update_available: true,
          desired_version: '2.0.1',
          current_version: '1.0.0',
          update_ready_version: null,
          restart_required: false,
          restart_requested_at: null,
        },
        layout,
        state: createInitialReleaseState('1.0.0'),
        fetchImpl: fetchRelease,
      }),
    ).rejects.toThrow(/checksum mismatch/i)
  })
})
