import { describe, expect, it, vi } from 'vitest'
import { createRefreshControllers } from '~/modules/tracking/interface/http/refresh.controllers'
import { RefreshSchemas } from '~/modules/tracking/interface/http/refresh.schemas'

describe('refresh controllers', () => {
  it('returns success for REST carrier refresh', async () => {
    const refreshRestUseCase = vi.fn(async () => ({
      kind: 'ok' as const,
      container: 'MSCU7654321',
      snapshotId: 'snapshot-1',
      status: 'IN_TRANSIT',
      newObservationsCount: 1,
      newAlertsCount: 0,
    }))

    const controllers = createRefreshControllers({
      refreshRestUseCase,
      refreshMaerskUseCase: vi.fn(),
    })

    const request = new Request('http://localhost/api/refresh', {
      method: 'POST',
      body: JSON.stringify({ container: 'MSCU7654321', carrier: 'msc' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await controllers.refresh({ request })
    const body = RefreshSchemas.responses.success.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.container).toBe('MSCU7654321')
    expect(body.snapshotId).toBe('snapshot-1')
    expect(refreshRestUseCase).toHaveBeenCalledTimes(1)
    expect(refreshRestUseCase).toHaveBeenCalledWith({
      container: 'MSCU7654321',
      provider: 'msc',
    })
  })

  it('returns maersk redirect for POST /api/refresh', async () => {
    const refreshRestUseCase = vi.fn(async () => ({
      kind: 'redirect' as const,
      redirectPath: '/api/refresh-maersk/MRKU1234567',
    }))

    const controllers = createRefreshControllers({
      refreshRestUseCase,
      refreshMaerskUseCase: vi.fn(),
    })

    const request = new Request('http://localhost/api/refresh', {
      method: 'POST',
      body: JSON.stringify({ container: 'MRKU1234567', carrier: 'maersk' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await controllers.refresh({ request })
    const body = RefreshSchemas.responses.redirect.parse(await response.json())

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('/api/refresh-maersk/MRKU1234567')
    expect(body.redirect).toBe('/api/refresh-maersk/MRKU1234567')
  })

  it('returns 404 when container does not exist', async () => {
    const controllers = createRefreshControllers({
      refreshRestUseCase: vi.fn(async () => ({
        kind: 'container_not_found' as const,
        container: 'MSCU7654321',
      })),
      refreshMaerskUseCase: vi.fn(),
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

  it('parses params/query and returns maersk success', async () => {
    const refreshMaerskUseCase = vi.fn(async () => ({
      kind: 'ok' as const,
      status: 200 as const,
      body: {
        ok: true as const,
        container: 'MRKU1234567',
        status: 200,
        savedToSupabase: true,
      },
    }))

    const controllers = createRefreshControllers({
      refreshRestUseCase: vi.fn(),
      refreshMaerskUseCase,
    })

    const request = new Request(
      'http://localhost/api/refresh-maersk/MRKU1234567?headless=1&hold=0&timeout=70000',
      {
        method: 'GET',
      },
    )

    const response = await controllers.refreshMaersk({
      params: { container: 'MRKU1234567' },
      request,
    })

    const body = RefreshSchemas.maersk.responses.success.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(refreshMaerskUseCase).toHaveBeenCalledTimes(1)
    expect(refreshMaerskUseCase).toHaveBeenCalledWith({
      container: 'MRKU1234567',
      headless: true,
      hold: false,
      timeoutMs: 70000,
      userDataDir: null,
    })
  })

  it('returns maersk error response from usecase', async () => {
    const controllers = createRefreshControllers({
      refreshRestUseCase: vi.fn(),
      refreshMaerskUseCase: vi.fn(async () => ({
        kind: 'error' as const,
        status: 403,
        body: {
          error: 'Access Denied by Akamai',
          hint: 'Try warmed profile',
        },
      })),
    })

    const request = new Request('http://localhost/api/refresh-maersk/MRKU1234567', {
      method: 'POST',
    })

    const response = await controllers.refreshMaersk({
      params: { container: 'MRKU1234567' },
      request,
    })

    const body = RefreshSchemas.maersk.responses.error.parse(await response.json())

    expect(response.status).toBe(403)
    expect(body.error).toContain('Access Denied')
  })
})
