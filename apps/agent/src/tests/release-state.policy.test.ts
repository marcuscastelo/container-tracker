import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readReleaseState, withRecordedFailure } from '@agent/release-state'
import { describe, expect, it } from 'vitest'

describe('release state crash-loop policy', () => {
  it('migrates legacy global crash-loop block to version-scoped block', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-release-state-test-'))
    const releaseStatePath = path.join(tempDir, 'release-state.json')

    fs.writeFileSync(
      releaseStatePath,
      JSON.stringify(
        {
          current_version: 'unknown',
          previous_version: 'unknown',
          last_known_good_version: 'unknown',
          target_version: null,
          activation_state: 'blocked',
          failure_count: 4,
          last_update_attempt: '2026-03-13T12:19:17.998Z',
          blocked_versions: ['0.2.2-alpha.1'],
          automatic_updates_blocked: true,
          recent_failures: [],
          activation_failures: {
            '0.2.2-alpha.1': 3,
          },
          last_error: null,
        },
        null,
        2,
      ),
      'utf8',
    )

    const migrated = readReleaseState(releaseStatePath, 'unknown')
    expect(migrated.automatic_updates_blocked).toBe(false)
    expect(migrated.activation_state).toBe('idle')
    expect(migrated.blocked_versions).toContain('0.2.2-alpha.1')
    expect(migrated.last_error).toContain('0.2.2-alpha.1')
  })

  it('migrates legacy blocked state even when blocked_versions is empty', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-release-state-test-'))
    const releaseStatePath = path.join(tempDir, 'release-state.json')

    fs.writeFileSync(
      releaseStatePath,
      JSON.stringify(
        {
          current_version: 'unknown',
          previous_version: 'unknown',
          last_known_good_version: 'unknown',
          target_version: null,
          activation_state: 'blocked',
          failure_count: 4,
          last_update_attempt: '2026-03-13T12:19:17.998Z',
          blocked_versions: [],
          automatic_updates_blocked: true,
          recent_failures: [],
          activation_failures: {},
          last_error: 'automatic updates are blocked due to previous crash loop',
        },
        null,
        2,
      ),
      'utf8',
    )

    const migrated = readReleaseState(releaseStatePath, 'unknown')
    expect(migrated.automatic_updates_blocked).toBe(false)
    expect(migrated.activation_state).toBe('idle')
    expect(migrated.blocked_versions).toEqual([])
  })

  it('blocks only the failing version when activation failure threshold is reached', () => {
    const now = Date.now()
    const first = withRecordedFailure({
      state: {
        current_version: '1.0.0',
        previous_version: null,
        last_known_good_version: '1.0.0',
        target_version: null,
        activation_state: 'idle',
        failure_count: 0,
        last_update_attempt: null,
        blocked_versions: [],
        automatic_updates_blocked: false,
        recent_failures: [],
        activation_failures: {},
        last_error: null,
      },
      version: '2.0.0',
      nowIso: new Date(now).toISOString(),
      crashLoopWindowMs: 5 * 60 * 1000,
      crashLoopThreshold: 10,
      maxActivationFailures: 2,
    })
    const second = withRecordedFailure({
      state: first.nextState,
      version: '2.0.0',
      nowIso: new Date(now + 1_000).toISOString(),
      crashLoopWindowMs: 5 * 60 * 1000,
      crashLoopThreshold: 10,
      maxActivationFailures: 2,
    })

    expect(second.versionBlocked).toBe(true)
    expect(second.newlyBlocked).toBe(true)
    expect(second.nextState.blocked_versions).toContain('2.0.0')
    expect(second.nextState.automatic_updates_blocked).toBe(false)
    expect(second.nextState.activation_state).toBe('idle')
  })
})
