import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AgentPathLayout } from '@agent/config/config.contract'
import {
  activatePendingRelease,
  confirmActivatedRelease,
} from '@agent/release/application/activate-release'
import { runReleaseCheckCycle } from '@agent/release/application/check-for-update'
import { rollbackRelease } from '@agent/release/application/rollback-release'
import { createInitialReleaseState } from '@agent/release/domain/release-state'
import {
  readReleaseState,
  writeReleaseState,
} from '@agent/release/infrastructure/release-state.file-repository'
import { describe, expect, it } from 'vitest'

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

function writeRelease(layout: AgentPathLayout, version: string): string {
  const releaseDir = path.join(layout.releasesDir, version)
  fs.mkdirSync(releaseDir, { recursive: true })
  fs.writeFileSync(path.join(releaseDir, 'agent.js'), `console.log('${version}')\n`, 'utf8')
  return releaseDir
}

function linkCurrent(layout: AgentPathLayout, releaseDir: string): void {
  const linkType = process.platform === 'win32' ? 'junction' : 'dir'
  if (fs.existsSync(layout.currentPath)) {
    fs.rmSync(layout.currentPath, { recursive: true, force: true })
  }
  fs.symlinkSync(releaseDir, layout.currentPath, linkType)
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

function createManifestFetch(command: {
  readonly manifest: Record<string, unknown>
  readonly releaseBody?: string
  readonly releasePath?: string
}): (input: string | URL | Request) => Promise<Response> {
  return async (input) => {
    const url = String(input)
    if (url.endsWith('/api/agent/update-manifest')) {
      return new Response(JSON.stringify(command.manifest), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (command.releaseBody && command.releasePath && url.endsWith(command.releasePath)) {
      return new Response(command.releaseBody, {
        status: 200,
        headers: { 'content-type': 'application/javascript' },
      })
    }

    return new Response('not found', { status: 404 })
  }
}

describe('release check cycle pipeline', () => {
  it('keeps state unchanged and does not request drain when no update exists', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-release-cycle-test-'))
    const layout = createLayout(tempDir)
    writeReleaseState(layout.releaseStatePath, createInitialReleaseState('1.0.0'))

    const result = await runReleaseCheckCycle({
      layout,
      fallbackVersion: '1.0.0',
      backendUrl: 'https://agent.test.local',
      agentToken: 'tok_test',
      agentId: 'agent-test',
      updateChannel: 'stable',
      fetchImpl: createManifestFetch({
        manifest: {
          version: '1.0.0',
          channel: 'stable',
          platforms: {},
          update_available: false,
          desired_version: null,
          current_version: '1.0.0',
          update_ready_version: null,
          restart_required: false,
          restart_requested_at: null,
        },
      }),
    })

    const stateAfter = readReleaseState(layout.releaseStatePath, '1.0.0')
    expect(result.shouldDrain).toBe(false)
    expect(result.updateAvailable).toBe(false)
    expect(stateAfter.target_version).toBeNull()
    expect(stateAfter.activation_state).toBe('idle')
  })

  it('stages update, marks pending, activates and commits when health is confirmed', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-release-cycle-test-'))
    const layout = createLayout(tempDir)
    const releaseV1 = writeRelease(layout, '1.0.0')
    linkCurrent(layout, releaseV1)

    const releaseBody = "console.log('2.0.0')\n"
    const checksum = sha256(releaseBody)
    writeReleaseState(layout.releaseStatePath, createInitialReleaseState('1.0.0'))

    const cycle = await runReleaseCheckCycle({
      layout,
      fallbackVersion: '1.0.0',
      backendUrl: 'https://agent.test.local',
      agentToken: 'tok_test',
      agentId: 'agent-test',
      updateChannel: 'stable',
      fetchImpl: createManifestFetch({
        manifest: {
          version: '2.0.0',
          channel: 'stable',
          platforms: {
            'linux-x64': {
              url: 'https://agent.test.local/release-v2.js',
              checksum,
            },
            'windows-x64': {
              url: 'https://agent.test.local/release-v2.js',
              checksum,
            },
          },
          update_available: true,
          desired_version: '2.0.0',
          current_version: '1.0.0',
          update_ready_version: null,
          restart_required: false,
          restart_requested_at: null,
        },
        releaseBody,
        releasePath: '/release-v2.js',
      }),
    })

    expect(cycle.shouldDrain).toBe(true)
    expect(cycle.drainReason).toBe('update')

    const pending = readReleaseState(layout.releaseStatePath, '1.0.0')
    expect(pending.activation_state).toBe('pending')
    expect(pending.target_version).toBe('2.0.0')

    const activated = activatePendingRelease({
      layout,
      state: pending,
      targetVersion: '2.0.0',
      nowIso: new Date().toISOString(),
    })
    writeReleaseState(layout.releaseStatePath, activated)

    const confirmed = confirmActivatedRelease({
      state: activated,
      confirmedVersion: '2.0.0',
      nowIso: new Date().toISOString(),
    })

    expect(confirmed.activation_state).toBe('idle')
    expect(confirmed.current_version).toBe('2.0.0')
    expect(confirmed.last_known_good_version).toBe('2.0.0')
    expect(confirmed.target_version).toBeNull()
  })

  it('rolls back when post-activation health fails', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-release-cycle-test-'))
    const layout = createLayout(tempDir)
    const releaseV1 = writeRelease(layout, '1.0.0')
    linkCurrent(layout, releaseV1)

    const releaseBody = "console.log('2.0.0')\n"
    const checksum = sha256(releaseBody)
    writeReleaseState(layout.releaseStatePath, createInitialReleaseState('1.0.0'))

    await runReleaseCheckCycle({
      layout,
      fallbackVersion: '1.0.0',
      backendUrl: 'https://agent.test.local',
      agentToken: 'tok_test',
      agentId: 'agent-test',
      updateChannel: 'stable',
      fetchImpl: createManifestFetch({
        manifest: {
          version: '2.0.0',
          channel: 'stable',
          platforms: {
            'linux-x64': {
              url: 'https://agent.test.local/release-v2.js',
              checksum,
            },
            'windows-x64': {
              url: 'https://agent.test.local/release-v2.js',
              checksum,
            },
          },
          update_available: true,
          desired_version: '2.0.0',
          current_version: '1.0.0',
          update_ready_version: null,
          restart_required: false,
          restart_requested_at: null,
        },
        releaseBody,
        releasePath: '/release-v2.js',
      }),
    })

    const pending = readReleaseState(layout.releaseStatePath, '1.0.0')
    const activated = activatePendingRelease({
      layout,
      state: pending,
      targetVersion: '2.0.0',
      nowIso: new Date().toISOString(),
    })

    const rolledBack = rollbackRelease({
      layout,
      state: activated,
      rollbackVersion: '1.0.0',
      nowIso: new Date().toISOString(),
      reason: 'health gate failed',
    })

    expect(rolledBack.activation_state).toBe('rolled_back')
    expect(rolledBack.current_version).toBe('1.0.0')
    expect(rolledBack.target_version).toBeNull()
    expect(fs.realpathSync(layout.currentPath)).toBe(path.join(layout.releasesDir, '1.0.0'))
  })
})
