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

    const controllers = createRefreshControllers({
      refreshRestUseCase,
      getSyncRequestStatuses: vi.fn(async () => ({ allTerminal: true, requests: [] })),
    })

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

    const controllers = createRefreshControllers({
      refreshRestUseCase,
      getSyncRequestStatuses: vi.fn(async () => ({ allTerminal: true, requests: [] })),
    })

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
      getSyncRequestStatuses: vi.fn(async () => ({ allTerminal: true, requests: [] })),
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
      getSyncRequestStatuses: vi.fn(async () => ({ allTerminal: true, requests: [] })),
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

  it('returns 400 for invalid refresh status query', async () => {
    const controllers = createRefreshControllers({
      refreshRestUseCase: vi.fn(),
      getSyncRequestStatuses: vi.fn(async () => ({ allTerminal: true, requests: [] })),
    })

    const request = new Request('http://localhost/api/refresh/status')

    const response = await controllers.status({ request })
    const body = RefreshSchemas.responses.error.parse(await response.json())

    expect(response.status).toBe(400)
    expect(body.error).toContain('sync_request_id')
  })

  it('returns status with allTerminal=false when requests are still open', async () => {
    const getSyncRequestStatuses = vi.fn(async () => ({
      allTerminal: false,
      requests: [
        {
          syncRequestId: 'e567dadb-b3ad-4f10-9f3f-d37f8f3163fc',
          status: 'PENDING' as const,
          lastError: null,
          updatedAt: '2026-02-25T10:05:00.000Z',
          refValue: 'MRKU2733926',
        },
      ],
    }))

    const controllers = createRefreshControllers({
      refreshRestUseCase: vi.fn(),
      getSyncRequestStatuses,
    })

    const request = new Request(
      'http://localhost/api/refresh/status?sync_request_id=e567dadb-b3ad-4f10-9f3f-d37f8f3163fc',
    )

    const response = await controllers.status({ request })
    const body = RefreshSchemas.responses.status.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.allTerminal).toBe(false)
    expect(body.requests[0]?.status).toBe('PENDING')
    expect(getSyncRequestStatuses).toHaveBeenCalledWith({
      syncRequestIds: ['e567dadb-b3ad-4f10-9f3f-d37f8f3163fc'],
    })
  })

  it('returns status with allTerminal=true when all requests are terminal', async () => {
    const controllers = createRefreshControllers({
      refreshRestUseCase: vi.fn(),
      getSyncRequestStatuses: vi.fn(async () => ({
        allTerminal: true,
        requests: [
          {
            syncRequestId: '377b29fd-97b6-4f9c-ad6e-66de6a66b565',
            status: 'DONE' as const,
            lastError: null,
            updatedAt: '2026-02-25T10:07:00.000Z',
            refValue: 'MRKU2733926',
          },
          {
            syncRequestId: '2999c8fb-1db8-4a48-bce2-b8fcf9f8908f',
            status: 'FAILED' as const,
            lastError: 'provider_unavailable',
            updatedAt: '2026-02-25T10:08:00.000Z',
            refValue: 'MRKU2733926',
          },
        ],
      })),
    })

    const request = new Request(
      'http://localhost/api/refresh/status?sync_request_id=377b29fd-97b6-4f9c-ad6e-66de6a66b565&sync_request_id=2999c8fb-1db8-4a48-bce2-b8fcf9f8908f',
    )

    const response = await controllers.status({ request })
    const body = RefreshSchemas.responses.status.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.allTerminal).toBe(true)
    expect(body.requests).toHaveLength(2)
    expect(body.requests[1]?.status).toBe('FAILED')
  })

  it('returns NOT_FOUND statuses when sync request does not exist', async () => {
    const controllers = createRefreshControllers({
      refreshRestUseCase: vi.fn(),
      getSyncRequestStatuses: vi.fn(async () => ({
        allTerminal: true,
        requests: [
          {
            syncRequestId: 'ec4536a8-9650-43d8-b68d-930f8a8bfe50',
            status: 'NOT_FOUND' as const,
            lastError: 'sync_request_not_found',
            updatedAt: null,
            refValue: null,
          },
        ],
      })),
    })

    const request = new Request(
      'http://localhost/api/refresh/status?sync_request_id=ec4536a8-9650-43d8-b68d-930f8a8bfe50',
    )

    const response = await controllers.status({ request })
    const body = RefreshSchemas.responses.status.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.allTerminal).toBe(true)
    expect(body.requests[0]?.status).toBe('NOT_FOUND')
    expect(body.requests[0]?.lastError).toBe('sync_request_not_found')
  })
})
