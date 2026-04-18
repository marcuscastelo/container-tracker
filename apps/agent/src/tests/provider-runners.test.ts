import type { ProviderInput } from '@agent/core/contracts/provider.contract'
import { createCmaCgmRunner } from '@agent/providers/cmacgm/run-cmacgm-sync'
import { createMaerskRunner } from '@agent/providers/maersk/run-maersk-sync'
import { createMscRunner } from '@agent/providers/msc/run-msc-sync'
import { createOneRunner } from '@agent/providers/one/run-one-sync'
import { createPilRunner } from '@agent/providers/pil/run-pil-sync'
import { describe, expect, it } from 'vitest'

function makeInput(provider: ProviderInput['provider']): ProviderInput {
  return {
    syncRequestId: '11111111-1111-4111-8111-111111111111',
    provider,
    refType: 'container',
    ref: 'MSCU1234567',
    hints: {
      timeoutMs: 120_000,
      maerskEnabled: true,
      maerskHeadless: true,
      maerskTimeoutMs: 120_000,
      maerskUserDataDir: null,
    },
    correlation: {
      tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      agentId: 'agent-a',
      agentVersion: '1.0.0',
    },
  }
}

describe('provider runners', () => {
  it('msc runner returns success for a valid fetch result', async () => {
    const runner = createMscRunner({
      async fetchStatus() {
        return {
          payload: { ok: true },
          fetchedAt: '2026-04-15T00:00:00.000Z',
          parseError: null,
        }
      },
    })

    const result = await runner.run(makeInput('msc'))
    expect(result.status).toBe('success')
  })

  it('cmacgm runner classifies parse error as blocked when captcha/waf is detected', async () => {
    const runner = createCmaCgmRunner({
      async fetchStatus() {
        return {
          payload: { blocked: true },
          fetchedAt: '2026-04-15T00:00:00.000Z',
          parseError: 'Request Rejected by WAF',
        }
      },
    })

    const result = await runner.run(makeInput('cmacgm'))
    expect(result.status).toBe('blocked')
  })

  it('cmacgm runner classifies unexpected snapshot shape as terminal failure', async () => {
    const runner = createCmaCgmRunner({
      async fetchStatus() {
        return {
          payload: {
            html: '<html><body>unknown</body></html>',
          },
          fetchedAt: '2026-04-15T00:00:00.000Z',
          parseError: null,
        }
      },
    })

    const result = await runner.run(makeInput('cmacgm'))
    expect(result.status).toBe('terminal_failure')
    expect(result.errorCode).toBe('PROVIDER_PARSE_ERROR')
  })

  it('cmacgm runner keeps close-enough payload as success and emits diagnostics warning', async () => {
    const runner = createCmaCgmRunner({
      async fetchStatus() {
        return {
          payload: {
            ContainerReference: 'MSCU1234567',
            PastMoves: [
              {
                Date: null,
                DateString: null,
                State: 'DONE',
                StatusDescription: null,
              },
            ],
          },
          fetchedAt: '2026-04-15T00:00:00.000Z',
          parseError: null,
        }
      },
    })

    const result = await runner.run(makeInput('cmacgm'))
    expect(result.status).toBe('success')
    expect(Array.isArray(result.diagnostics.warnings)).toBe(true)
  })

  it('pil runner classifies timeout exceptions as retryable failures', async () => {
    const runner = createPilRunner({
      async fetchStatus() {
        throw new Error('timeout while calling carrier endpoint')
      },
    })

    const result = await runner.run(makeInput('pil'))
    expect(result.status).toBe('retryable_failure')
  })

  it('one runner classifies parse errors as terminal failures', async () => {
    const runner = createOneRunner({
      async fetchStatus() {
        return {
          payload: { malformed: true },
          fetchedAt: '2026-04-15T00:00:00.000Z',
          parseError: 'ONE response missing expected status/code/data shape',
        }
      },
    })

    const result = await runner.run(makeInput('one'))
    expect(result.status).toBe('terminal_failure')
  })

  it('maersk runner classifies captcha-like errors as blocked', async () => {
    const runner = createMaerskRunner({
      captureService: {
        async capture() {
          return {
            kind: 'error' as const,
            status: 403,
            body: {
              error: 'captcha challenge required',
            },
          }
        },
      },
    })

    const result = await runner.run(makeInput('maersk'))
    expect(result.status).toBe('blocked')
  })
})
