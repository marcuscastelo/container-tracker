import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { createInitialReleaseState } from '@agent/release-state'
import type { AgentPathLayout } from '@agent/runtime-paths'
import { fetchUpdateManifest, stageReleaseFromManifest } from '@agent/updater.core'
import { describe, expect, it } from 'vitest'

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function createLayout(baseDir: string): AgentPathLayout {
  const layout: AgentPathLayout = {
    dataDir: baseDir,
    configEnvPath: path.join(baseDir, 'config.env'),
    baseRuntimeConfigPath: path.join(baseDir, 'control-base.runtime.json'),
    bootstrapEnvPath: path.join(baseDir, 'bootstrap.env'),
    consumedBootstrapEnvPath: path.join(baseDir, 'bootstrap.env.consumed'),
    releasesDir: path.join(baseDir, 'releases'),
    downloadsDir: path.join(baseDir, 'downloads'),
    logsDir: path.join(baseDir, 'logs'),
    currentPath: path.join(baseDir, 'current'),
    previousPath: path.join(baseDir, 'previous'),
    releaseStatePath: path.join(baseDir, 'release-state.json'),
    runtimeStatePath: path.join(baseDir, 'runtime-state.json'),
    supervisorControlPath: path.join(baseDir, 'supervisor-control.json'),
    pendingActivityPath: path.join(baseDir, 'pending-activity-events.json'),
    controlOverridesPath: path.join(baseDir, 'control-overrides.local.json'),
    controlRemoteCachePath: path.join(baseDir, 'control-remote-cache.json'),
    infraConfigPath: path.join(baseDir, 'infra-config.json'),
    auditLogPath: path.join(baseDir, 'agent-control-audit.ndjson'),
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

  it('selects platform asset from unified manifest payload', async () => {
    const fetchManifest = async (): Promise<Response> => {
      return new Response(
        JSON.stringify({
          version: '2.0.0',
          channel: 'stable',
          platforms: {
            'linux-x64': {
              url: 'https://example.com/agent-v2-linux.tar.gz',
              checksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            },
            'windows-x64': {
              url: 'https://example.com/agent-v2-windows.zip',
              checksum: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            },
          },
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

    const manifest = await fetchUpdateManifest(
      {
        backendUrl: 'https://agent.test.local',
        agentToken: 'tok_test',
        agentId: 'agent-test',
        platform: 'windows-x64',
      },
      fetchManifest,
    )

    expect(manifest.download_url).toBe('https://example.com/agent-v2-windows.zip')
    expect(manifest.checksum).toBe(
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    )
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

  it('removes stale release directory when entrypoint is missing before restaging', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-updater-test-'))
    const layout = createLayout(tempDir)
    const staleReleaseDir = path.join(layout.releasesDir, '2.0.2')
    fs.mkdirSync(staleReleaseDir, { recursive: true })
    fs.writeFileSync(path.join(staleReleaseDir, 'stale.txt'), 'stale release content\n', 'utf8')

    const releaseBody = "console.log('agent v202')\n"
    const checksum = sha256(releaseBody)
    const fetchRelease = async (): Promise<Response> =>
      new Response(releaseBody, {
        status: 200,
        headers: { 'content-type': 'application/javascript' },
      })

    const result = await stageReleaseFromManifest({
      manifest: {
        version: '2.0.2',
        download_url: 'https://agent.test.local/release-v202.js',
        checksum,
        channel: 'stable',
        update_available: true,
        desired_version: '2.0.2',
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
    expect(fs.existsSync(path.join(result.releaseDir, 'stale.txt'))).toBe(false)
    expect(fs.readFileSync(path.join(result.releaseDir, 'agent.js'), 'utf8')).toBe(releaseBody)
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

  it('skips blocked versions without disabling updater globally', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-updater-test-'))
    const layout = createLayout(tempDir)

    const result = await stageReleaseFromManifest({
      manifest: {
        version: '2.0.0',
        download_url: 'https://agent.test.local/release-v2.js',
        checksum: sha256("console.log('agent v2')\n"),
        channel: 'stable',
        update_available: true,
        desired_version: '2.0.0',
        current_version: '1.0.0',
        update_ready_version: null,
        restart_required: false,
        restart_requested_at: null,
      },
      layout,
      state: {
        ...createInitialReleaseState('1.0.0'),
        blocked_versions: ['2.0.0'],
        automatic_updates_blocked: false,
      },
      fetchImpl: async () => new Response('should-not-download', { status: 200 }),
    })

    expect(result.kind).toBe('blocked')
    if (result.kind !== 'blocked') return
    expect(result.reason).toContain('blocked locally')
  })
})
