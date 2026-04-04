import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  dismissServerProblemBanner,
  readServerProblemBannerState,
  reportHttpFailure,
  resetServerProblemBannerForTests,
} from '~/shared/api/httpDegradationReporter'
import { typedFetch } from '~/shared/api/typedFetch'

const TestResponseSchema = z.object({
  ok: z.boolean(),
})

function enableBrowserRuntime(): void {
  vi.stubGlobal('window', {})
}

function toJsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

describe('typedFetch', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    resetServerProblemBannerForTests()
  })

  it('reports 5xx responses to the global degradation banner', async () => {
    enableBrowserRuntime()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      toJsonResponse({ error: 'server exploded' }, 503),
    )

    await expect(typedFetch('/api/test', undefined, TestResponseSchema)).rejects.toThrow(
      'server exploded',
    )

    expect(readServerProblemBannerState().visible).toBe(true)
  })

  it('does not report 4xx responses to the global degradation banner', async () => {
    enableBrowserRuntime()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(toJsonResponse({ error: 'not found' }, 404))

    await expect(typedFetch('/api/test', undefined, TestResponseSchema)).rejects.toThrow(
      'not found',
    )

    expect(readServerProblemBannerState().visible).toBe(false)
  })

  it('reports network rejections to the global degradation banner', async () => {
    enableBrowserRuntime()
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))

    await expect(typedFetch('/api/test', undefined, TestResponseSchema)).rejects.toThrow(
      'network down',
    )

    expect(readServerProblemBannerState().visible).toBe(true)
  })

  it('rearms the banner after a successful monitored request', async () => {
    enableBrowserRuntime()
    reportHttpFailure({ status: 503 })
    dismissServerProblemBanner()

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockResolvedValueOnce(toJsonResponse({ ok: true }, 200))
    fetchSpy.mockResolvedValueOnce(toJsonResponse({ error: 'server exploded' }, 503))

    await expect(typedFetch('/api/test-ok', undefined, TestResponseSchema)).resolves.toEqual({
      ok: true,
    })
    expect(readServerProblemBannerState().visible).toBe(false)

    await expect(typedFetch('/api/test-fail', undefined, TestResponseSchema)).rejects.toThrow(
      'server exploded',
    )
    expect(readServerProblemBannerState().visible).toBe(true)
  })
})
