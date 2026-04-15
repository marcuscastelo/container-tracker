import { resolveSupervisorReleaseChecksMode } from '@agent/release/application/release-checks-mode'
import { describe, expect, it } from 'vitest'

describe('resolveReleaseChecksMode', () => {
  it('disables checks from explicit dev flag without masking the configured channel', () => {
    const mode = resolveSupervisorReleaseChecksMode({
      env: {
        AGENT_DISABLE_AUTOMATIC_UPDATE_CHECKS: '1',
      },
      configuredChannel: 'canary',
    })

    expect(mode.disabled).toBe(true)
    expect(mode.reason).toBe('EXPLICIT_DISABLE_FLAG')
    expect(mode.configuredChannel).toBe('canary')
  })

  it('disables checks when channel is explicitly disabled', () => {
    const mode = resolveSupervisorReleaseChecksMode({
      env: {},
      configuredChannel: 'disabled',
    })

    expect(mode.disabled).toBe(true)
    expect(mode.reason).toBe('CHANNEL_DISABLED')
    expect(mode.configuredChannel).toBe('disabled')
  })

  it('keeps checks enabled when channel is canary and no override is present', () => {
    const mode = resolveSupervisorReleaseChecksMode({
      env: {},
      configuredChannel: 'canary',
    })

    expect(mode.disabled).toBe(false)
    expect(mode.reason).toBeNull()
    expect(mode.configuredChannel).toBe('canary')
  })
})
