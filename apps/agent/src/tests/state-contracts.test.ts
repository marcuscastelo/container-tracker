import { serializeReleaseState, toReleaseState } from '@agent/state/release-state.mapper'
import { serializeRuntimeState, toRuntimeState } from '@agent/state/runtime-state.mapper'
import { describe, expect, it } from 'vitest'

describe('state contracts', () => {
  it('round-trips release state through mapper and serializer', () => {
    const state = toReleaseState({
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
    })

    const json = serializeReleaseState(state)
    const roundTrip = toReleaseState(JSON.parse(json))
    expect(roundTrip.current_version).toBe('1.0.0')
  })

  it('rejects invalid runtime state payload', () => {
    expect(() =>
      toRuntimeState({
        agent_version: '1.0.0',
        boot_status: 'healthy',
        update_state: 'idle',
      }),
    ).toThrowError()
  })

  it('rejects invalid release state payload', () => {
    expect(() =>
      toReleaseState({
        current_version: '',
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
      }),
    ).toThrowError()
  })

  it('round-trips runtime state through mapper and serializer', () => {
    const runtime = toRuntimeState({
      agent_version: '1.0.0',
      boot_status: 'healthy',
      update_state: 'idle',
      last_heartbeat_at: '2026-04-14T10:00:00.000Z',
      last_heartbeat_ok_at: '2026-04-14T10:00:00.000Z',
      active_jobs: 0,
      processing_state: 'idle',
      updated_at: '2026-04-14T10:00:01.000Z',
      pid: 123,
    })

    const json = serializeRuntimeState(runtime)
    const roundTrip = toRuntimeState(JSON.parse(json))
    expect(roundTrip.pid).toBe(123)
  })
})
