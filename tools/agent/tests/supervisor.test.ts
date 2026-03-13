import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  confirmRelease,
  resolveRuntimeEntrypoint,
  rollbackRelease,
} from '@tools/agent/release-manager'
import { createInitialReleaseState, withRecordedFailure } from '@tools/agent/release-state'
import type { AgentPathLayout } from '@tools/agent/runtime-paths'
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

function writeReleaseEntrypoint(layout: AgentPathLayout, version: string): string {
  const releaseDir = path.join(layout.releasesDir, version)
  fs.mkdirSync(releaseDir, { recursive: true })
  const entrypoint = path.join(releaseDir, 'agent.js')
  fs.writeFileSync(entrypoint, "console.log('ok')\n", 'utf8')
  return releaseDir
}

function writeReleaseWithSupervisorShim(
  layout: AgentPathLayout,
  version: string,
): {
  readonly releaseDir: string
  readonly runtimeEntrypoint: string
} {
  const releaseDir = path.join(layout.releasesDir, version)
  const runtimeEntrypoint = path.join(releaseDir, 'app', 'dist', 'tools', 'agent', 'agent.js')
  const supervisorShimEntrypoint = path.join(releaseDir, 'app', 'dist', 'agent.js')

  fs.mkdirSync(path.dirname(runtimeEntrypoint), { recursive: true })
  fs.writeFileSync(runtimeEntrypoint, "console.log('runtime')\n", 'utf8')
  fs.writeFileSync(supervisorShimEntrypoint, "import './tools/agent/supervisor.js'\n", 'utf8')

  return {
    releaseDir,
    runtimeEntrypoint,
  }
}

function linkCurrent(layout: AgentPathLayout, releaseDir: string): void {
  const linkType = process.platform === 'win32' ? 'junction' : 'dir'
  if (fs.existsSync(layout.currentLinkPath)) {
    fs.rmSync(layout.currentLinkPath, { recursive: true, force: true })
  }
  fs.symlinkSync(releaseDir, layout.currentLinkPath, linkType)
}

describe('supervisor release policies', () => {
  it('confirms release after healthy boot stability window', () => {
    const state = createInitialReleaseState('1.0.0')
    const confirmed = confirmRelease({
      state: {
        ...state,
        current_version: '2.0.0',
        target_version: '2.0.0',
        activation_state: 'verifying',
      },
      confirmedVersion: '2.0.0',
      nowIso: new Date().toISOString(),
    })

    expect(confirmed.current_version).toBe('2.0.0')
    expect(confirmed.last_known_good_version).toBe('2.0.0')
    expect(confirmed.activation_state).toBe('idle')
    expect(confirmed.target_version).toBeNull()
  })

  it('rolls back to last known good release on boot failure', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-supervisor-test-'))
    const layout = createLayout(tempDir)
    const releaseV1 = writeReleaseEntrypoint(layout, '1.0.0')
    writeReleaseEntrypoint(layout, '2.0.0')
    linkCurrent(layout, path.join(layout.releasesDir, '2.0.0'))

    const rolledBack = rollbackRelease({
      layout,
      state: {
        ...createInitialReleaseState('1.0.0'),
        current_version: '2.0.0',
        target_version: '2.0.0',
        activation_state: 'verifying',
        last_known_good_version: '1.0.0',
      },
      rollbackVersion: '1.0.0',
      nowIso: new Date().toISOString(),
      reason: 'startup timeout',
      crashLoopDetected: false,
    })

    const currentRealpath = fs.realpathSync(layout.currentLinkPath)
    expect(currentRealpath).toBe(releaseV1)
    expect(rolledBack.current_version).toBe('1.0.0')
    expect(rolledBack.activation_state).toBe('rolled_back')
  })

  it('marks version as blocked when crash loop threshold is reached', () => {
    const baseState = createInitialReleaseState('1.0.0')
    const now = Date.now()

    const first = withRecordedFailure({
      state: baseState,
      version: '2.0.0',
      nowIso: new Date(now).toISOString(),
      crashLoopWindowMs: 5 * 60 * 1000,
      crashLoopThreshold: 3,
      maxActivationFailures: 5,
    })
    const second = withRecordedFailure({
      state: first.nextState,
      version: '2.0.0',
      nowIso: new Date(now + 10_000).toISOString(),
      crashLoopWindowMs: 5 * 60 * 1000,
      crashLoopThreshold: 3,
      maxActivationFailures: 5,
    })
    const third = withRecordedFailure({
      state: second.nextState,
      version: '2.0.0',
      nowIso: new Date(now + 20_000).toISOString(),
      crashLoopWindowMs: 5 * 60 * 1000,
      crashLoopThreshold: 3,
      maxActivationFailures: 5,
    })

    expect(third.isCrashLoop).toBe(true)
    expect(third.nextState.activation_state).toBe('idle')
    expect(third.nextState.blocked_versions).toContain('2.0.0')
    expect(third.nextState.automatic_updates_blocked).toBe(false)
    expect(third.newlyBlocked).toBe(true)
  })

  it('clears release links and falls back when rollback target is missing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-supervisor-test-'))
    const layout = createLayout(tempDir)
    const releaseV1 = writeReleaseEntrypoint(layout, '1.0.0')
    linkCurrent(layout, releaseV1)
    const linkType = process.platform === 'win32' ? 'junction' : 'dir'
    fs.symlinkSync(releaseV1, layout.previousLinkPath, linkType)

    const rolledBack = rollbackRelease({
      layout,
      state: {
        ...createInitialReleaseState('1.0.0'),
        current_version: '1.0.0',
        target_version: '2.0.0',
        activation_state: 'verifying',
        last_known_good_version: '1.0.0',
      },
      rollbackVersion: 'fallback-runtime',
      nowIso: new Date().toISOString(),
      reason: 'release directory missing',
      crashLoopDetected: false,
    })

    expect(fs.existsSync(layout.currentLinkPath)).toBe(false)
    expect(fs.existsSync(layout.previousLinkPath)).toBe(false)

    const fallbackEntrypoint = path.join(tempDir, 'agent-fallback.js')
    fs.writeFileSync(fallbackEntrypoint, "console.log('fallback')\n", 'utf8')
    const runtimeSelection = resolveRuntimeEntrypoint({
      layout,
      fallbackEntrypoint,
      expectedVersion: rolledBack.current_version,
    })

    expect(runtimeSelection.source).toBe('fallback')
    expect(runtimeSelection.entrypointPath).toBe(fallbackEntrypoint)
    expect(rolledBack.current_version).toBe('fallback-runtime')
  })

  it('removes invalid current release directory when runtime entrypoint is missing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-supervisor-test-'))
    const layout = createLayout(tempDir)
    const invalidReleaseDir = path.join(layout.releasesDir, '2.0.9')
    fs.mkdirSync(invalidReleaseDir, { recursive: true })
    fs.writeFileSync(path.join(invalidReleaseDir, 'stale.txt'), 'invalid release payload\n', 'utf8')
    linkCurrent(layout, invalidReleaseDir)

    const fallbackEntrypoint = path.join(tempDir, 'agent-fallback.js')
    fs.writeFileSync(fallbackEntrypoint, "console.log('fallback')\n", 'utf8')

    const runtimeSelection = resolveRuntimeEntrypoint({
      layout,
      fallbackEntrypoint,
      expectedVersion: '2.0.9',
    })

    expect(runtimeSelection.source).toBe('fallback')
    expect(runtimeSelection.entrypointPath).toBe(fallbackEntrypoint)
    expect(fs.existsSync(layout.currentLinkPath)).toBe(false)
    expect(fs.existsSync(invalidReleaseDir)).toBe(false)
  })

  it('skips supervisor shim entrypoint when selecting release runtime', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-supervisor-test-'))
    const layout = createLayout(tempDir)
    const release = writeReleaseWithSupervisorShim(layout, '2.0.0')
    linkCurrent(layout, release.releaseDir)

    const runtimeSelection = resolveRuntimeEntrypoint({
      layout,
      fallbackEntrypoint: path.join(tempDir, 'agent-fallback.js'),
      expectedVersion: '2.0.0',
    })

    expect(runtimeSelection.source).toBe('release')
    expect(runtimeSelection.entrypointPath).toBe(release.runtimeEntrypoint)
  })
})
