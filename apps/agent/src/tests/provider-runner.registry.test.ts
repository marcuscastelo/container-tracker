import type { ProviderRunner } from '@agent/providers/common/provider-result'
import { createProviderRunnerRegistry } from '@agent/providers/common/provider-runner.registry'
import { describe, expect, it } from 'vitest'

function makeRunner(provider: ProviderRunner['provider']): ProviderRunner {
  return {
    provider,
    async run(input) {
      return {
        status: 'success',
        observedAt: '2026-04-15T00:00:00.000Z',
        raw: { provider: input.provider },
        parseError: null,
        errorCode: null,
        errorMessage: null,
        diagnostics: {},
        timing: {
          startedAt: '2026-04-15T00:00:00.000Z',
          finishedAt: '2026-04-15T00:00:00.100Z',
          durationMs: 100,
        },
      }
    },
  }
}

describe('provider runner registry', () => {
  it('selects the runner registered for a provider', () => {
    const registry = createProviderRunnerRegistry({
      runners: [makeRunner('msc'), makeRunner('one')],
    })

    const selected = registry.selectProviderRunner('one')
    expect(selected?.provider).toBe('one')
  })

  it('returns null for unsupported provider in the registry', () => {
    const registry = createProviderRunnerRegistry({
      runners: [makeRunner('msc')],
    })

    const selected = registry.selectProviderRunner('maersk')
    expect(selected).toBeNull()
  })
})
