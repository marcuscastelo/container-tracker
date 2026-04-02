import { describe, expect, it } from 'vitest'
import { z } from 'zod/v4'
import { jsonResponse } from '~/shared/api/typedRoute'

describe('jsonResponse', () => {
  it('merges Headers instances without losing the JSON content type', async () => {
    const response = jsonResponse(
      { ok: true },
      200,
      z.object({ ok: z.boolean() }),
      new Headers([
        ['Content-Type', 'text/plain'],
        ['X-Request-Id', 'request-123'],
      ]),
    )

    expect(response.headers.get('content-type')).toBe('application/json')
    expect(response.headers.get('x-request-id')).toBe('request-123')
    expect(await response.json()).toEqual({ ok: true })
  })

  it('merges header tuples without losing the JSON content type', async () => {
    const response = jsonResponse({ ok: true }, 200, z.object({ ok: z.boolean() }), [
      ['X-Trace-Id', 'trace-456'],
    ])

    expect(response.headers.get('content-type')).toBe('application/json')
    expect(response.headers.get('x-trace-id')).toBe('trace-456')
    expect(await response.json()).toEqual({ ok: true })
  })
})
