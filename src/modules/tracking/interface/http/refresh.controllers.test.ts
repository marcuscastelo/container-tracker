import { describe, expect, it, vi } from 'vitest'

import { createRefreshControllers } from '~/modules/tracking/interface/http/refresh.controllers'
import { RefreshSchemas } from '~/modules/tracking/interface/http/refresh.schemas'

describe('refresh controllers', () => {
  it('returns 202 queued when sync request is created', async () => {
    const refreshRestUseCase = vi.fn(async () => ({
      kind: 'queued' as const,
      container: 'MSCU7654321',
      syncRequestId: 'ac8c52bf-0e1d-49db-9441-5586f86f0e31',
      queued: true as const,
      deduped: false,
    }))

    const controllers = createRefreshControllers({ refreshRestUseCase })

    const request = new Request('http://localhost/api/refresh', {
      method: 'POST',
      body: JSON.stringify({ container: 'MSCU7654321', carrier: 'msc' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await controllers.refresh({ request })
    const body = RefreshSchemas.responses.success.parse(await response.json())

    expect(response.status).toBe(202)
    expect(body.ok).toBe(true)
    expect(body.container).toBe('MSCU7654321')
    expect(body.syncRequestId).toBe('ac8c52bf-0e1d-49db-9441-5586f86f0e31')
    expect(body.queued).toBe(true)
    expect(body.deduped).toBe(false)
    expect(refreshRestUseCase).toHaveBeenCalledTimes(1)
    expect(refreshRestUseCase).toHaveBeenCalledWith({
      container: 'MSCU7654321',
      provider: 'msc',
    })
  })

  it('returns 202 queued when sync request is deduped', async () => {
    const refreshRestUseCase = vi.fn(async () => ({
      kind: 'queued' as const,
      container: 'MRKU1234567',
      syncRequestId: 'f0787fe1-7767-44ca-8f3b-5966d1571318',
      queued: true as const,
      deduped: true,
    }))

    const controllers = createRefreshControllers({ refreshRestUseCase })

    const request = new Request('http://localhost/api/refresh', {
      method: 'POST',
      body: JSON.stringify({ container: 'MRKU1234567', carrier: 'maersk' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await controllers.refresh({ request })
    const body = RefreshSchemas.responses.success.parse(await response.json())

    expect(response.status).toBe(202)
    expect(body.deduped).toBe(true)
  })

  it('returns 404 when container does not exist', async () => {
    const controllers = createRefreshControllers({
      refreshRestUseCase: vi.fn(async () => ({
        kind: 'container_not_found' as const,
        container: 'MSCU7654321',
      })),
    })

    const request = new Request('http://localhost/api/refresh', {
      method: 'POST',
      body: JSON.stringify({ container: 'MSCU7654321', carrier: 'msc' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await controllers.refresh({ request })
    const body = RefreshSchemas.responses.error.parse(await response.json())

    expect(response.status).toBe(404)
    expect(body.error).toContain('MSCU7654321')
  })

  it('returns 400 for invalid refresh payload', async () => {
    const controllers = createRefreshControllers({
      refreshRestUseCase: vi.fn(),
    })

    const request = new Request('http://localhost/api/refresh', {
      method: 'POST',
      body: JSON.stringify({ container: 'MSCU7654321' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await controllers.refresh({ request })
    const body = RefreshSchemas.responses.error.parse(await response.json())

    expect(response.status).toBe(400)
    expect(body.error).toContain('carrier')
  })
})
