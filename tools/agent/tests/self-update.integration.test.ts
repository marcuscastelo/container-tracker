import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  activateTargetRelease,
  confirmRelease,
  rollbackRelease,
} from '@tools/agent/release-manager'
import { createInitialReleaseState, withRecordedFailure } from '@tools/agent/release-state'
import type { AgentPathLayout } from '@tools/agent/runtime-paths'
import { stageReleaseFromManifest } from '@tools/agent/updater.core'
import { describe, expect, it } from 'vitest'

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

function writeRelease(layout: AgentPathLayout, version: string): string {
  const releaseDir = path.join(layout.releasesDir, version)
  fs.mkdirSync(releaseDir, { recursive: true })
  fs.writeFileSync(path.join(releaseDir, 'agent.js'), `console.log('${version}')\n`, 'utf8')
  return releaseDir
}

function linkCurrent(layout: AgentPathLayout, releaseDir: string): void {
  const linkType = process.platform === 'win32' ? 'junction' : 'dir'
  if (fs.existsSync(layout.currentLinkPath)) {
    fs.rmSync(layout.currentLinkPath, { recursive: true, force: true })
  }
  fs.symlinkSync(releaseDir, layout.currentLinkPath, linkType)
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

describe('self-update integration flows', () => {
  it('update -> restart -> healthy confirms new release', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-integration-test-'))
    const layout = createLayout(tempDir)
    const releaseV1 = writeRelease(layout, '1.0.0')
    linkCurrent(layout, releaseV1)

    const releaseBody = "console.log('2.0.0')\n"
    const checksum = sha256(releaseBody)
    const fetchRelease = async (): Promise<Response> =>
      new Response(releaseBody, {
        status: 200,
        headers: { 'content-type': 'application/javascript' },
      })

    const staged = await stageReleaseFromManifest({
      manifest: {
        version: '2.0.0',
        download_url: 'https://agent.test.local/release.js',
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

    expect(staged.kind).toBe('staged')

    const activated = activateTargetRelease({
      layout,
      state: {
        ...createInitialReleaseState('1.0.0'),
        target_version: '2.0.0',
        activation_state: 'pending',
      },
      targetVersion: '2.0.0',
      nowIso: new Date().toISOString(),
    })

    const confirmed = confirmRelease({
      state: activated,
      confirmedVersion: '2.0.0',
      nowIso: new Date().toISOString(),
    })

    expect(confirmed.current_version).toBe('2.0.0')
    expect(confirmed.last_known_good_version).toBe('2.0.0')
    expect(confirmed.activation_state).toBe('idle')
  })

  it('update -> crash -> rollback restores previous release', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-integration-test-'))
    const layout = createLayout(tempDir)
    const releaseV1 = writeRelease(layout, '1.0.0')
    writeRelease(layout, '2.0.0')
    linkCurrent(layout, releaseV1)

    const activated = activateTargetRelease({
      layout,
      state: {
        ...createInitialReleaseState('1.0.0'),
        target_version: '2.0.0',
        activation_state: 'pending',
      },
      targetVersion: '2.0.0',
      nowIso: new Date().toISOString(),
    })

    const failure = withRecordedFailure({
      state: activated,
      version: '2.0.0',
      nowIso: new Date().toISOString(),
      crashLoopWindowMs: 5 * 60 * 1000,
      crashLoopThreshold: 3,
      maxActivationFailures: 5,
    })

    const rolledBack = rollbackRelease({
      layout,
      state: failure.nextState,
      rollbackVersion: '1.0.0',
      nowIso: new Date().toISOString(),
      reason: 'runtime crashed before heartbeat',
    })

    const currentRealpath = fs.realpathSync(layout.currentLinkPath)
    expect(currentRealpath).toBe(path.join(layout.releasesDir, '1.0.0'))
    expect(rolledBack.current_version).toBe('1.0.0')
    expect(rolledBack.activation_state).toBe('rolled_back')
    expect(rolledBack.last_known_good_version).toBe('1.0.0')
  })
})
