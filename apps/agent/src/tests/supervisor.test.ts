import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AgentPathLayout } from '@agent/config/config.contract'
import { confirmActivatedRelease } from '@agent/release/application/activate-release'
import { getCurrentRelease } from '@agent/release/application/get-current-release'
import { rollbackRelease } from '@agent/release/application/rollback-release'
import { createInitialReleaseState, withRecordedFailure } from '@agent/release/domain/release-state'
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
  const runtimeEntrypoint = path.join(releaseDir, 'app', 'dist', 'apps', 'agent', 'src', 'agent.js')
  const supervisorShimEntrypoint = path.join(releaseDir, 'app', 'dist', 'agent.js')

  fs.mkdirSync(path.dirname(runtimeEntrypoint), { recursive: true })
  fs.writeFileSync(runtimeEntrypoint, "console.log('runtime')\n", 'utf8')
  fs.writeFileSync(supervisorShimEntrypoint, "import './apps/agent/src/supervisor.js'\n", 'utf8')

  return {
    releaseDir,
    runtimeEntrypoint,
  }
}

function linkCurrent(layout: AgentPathLayout, releaseDir: string): void {
  const linkType = process.platform === 'win32' ? 'junction' : 'dir'
  if (fs.existsSync(layout.currentPath)) {
    fs.rmSync(layout.currentPath, { recursive: true, force: true })
  }
  fs.symlinkSync(releaseDir, layout.currentPath, linkType)
}

describe('supervisor release policies', () => {
  it('confirms release after healthy boot stability window', () => {
    const state = createInitialReleaseState('1.0.0')
    const confirmed = confirmActivatedRelease({
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
    })

    const currentRealpath = fs.realpathSync(layout.currentPath)
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
    fs.symlinkSync(releaseV1, layout.previousPath, linkType)

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
    })

    expect(fs.existsSync(layout.currentPath)).toBe(false)
    expect(fs.existsSync(layout.previousPath)).toBe(false)

    const fallbackEntrypoint = path.join(tempDir, 'agent-fallback.js')
    fs.writeFileSync(fallbackEntrypoint, "console.log('fallback')\n", 'utf8')
    const runtimeSelection = getCurrentRelease({
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

    const runtimeSelection = getCurrentRelease({
      layout,
      fallbackEntrypoint,
      expectedVersion: '2.0.9',
    })

    expect(runtimeSelection.source).toBe('fallback')
    expect(runtimeSelection.entrypointPath).toBe(fallbackEntrypoint)
    expect(fs.existsSync(layout.currentPath)).toBe(false)
    expect(fs.existsSync(invalidReleaseDir)).toBe(false)
  })

  it('skips supervisor shim entrypoint when selecting release runtime', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-supervisor-test-'))
    const layout = createLayout(tempDir)
    const release = writeReleaseWithSupervisorShim(layout, '2.0.0')
    linkCurrent(layout, release.releaseDir)

    const runtimeSelection = getCurrentRelease({
      layout,
      fallbackEntrypoint: path.join(tempDir, 'agent-fallback.js'),
      expectedVersion: '2.0.0',
    })

    expect(runtimeSelection.source).toBe('release')
    expect(runtimeSelection.entrypointPath).toBe(release.runtimeEntrypoint)
  })
})
