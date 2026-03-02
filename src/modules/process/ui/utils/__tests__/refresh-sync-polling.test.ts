import { describe, expect, it, vi } from 'vitest'
import {
  calculateExponentialBackoffDelay,
  isTerminalSyncStatus,
  pollRefreshSyncStatus,
} from '~/modules/process/ui/utils/refresh-sync-polling'

describe('refresh-sync-polling', () => {
  it('calculates exponential backoff delays', () => {
    expect(calculateExponentialBackoffDelay(1, 5000)).toBe(5000)
    expect(calculateExponentialBackoffDelay(2, 5000)).toBe(10000)
    expect(calculateExponentialBackoffDelay(3, 5000)).toBe(20000)
    expect(calculateExponentialBackoffDelay(4, 5000)).toBe(40000)
    expect(calculateExponentialBackoffDelay(5, 5000)).toBe(80000)
  })

  it('stops on first retry when all requests are DONE', async () => {
    const sleep = vi.fn(async () => undefined)
    const onRetryStart = vi.fn()
    const fetchSyncStatus = vi.fn(async () => ({
      ok: true as const,
      allTerminal: true,
      requests: [
        {
          syncRequestId: 'e567dadb-b3ad-4f10-9f3f-d37f8f3163fc',
          status: 'DONE' as const,
          lastError: null,
          updatedAt: '2026-02-25T10:05:00.000Z',
          refValue: 'MRKU2733926',
        },
      ],
    }))

    const result = await pollRefreshSyncStatus({
      syncRequestIds: ['e567dadb-b3ad-4f10-9f3f-d37f8f3163fc'],
      maxRetries: 5,
      initialDelayMs: 5000,
      fetchSyncStatus,
      onRetryStart,
      sleep,
    })

    expect(result.kind).toBe('completed')
    expect(result.attempts).toBe(1)
    expect(onRetryStart).toHaveBeenCalledTimes(1)
    expect(onRetryStart).toHaveBeenCalledWith({ current: 1, total: 5 })
    expect(sleep).toHaveBeenCalledTimes(1)
    expect(sleep).toHaveBeenCalledWith(5000)
    expect(fetchSyncStatus).toHaveBeenCalledTimes(1)
  })

  it('retries while any request is PENDING/LEASED and finishes when terminal', async () => {
    const sleep = vi.fn(async () => undefined)
    const fetchSyncStatus = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true as const,
        allTerminal: false,
        requests: [
          {
            syncRequestId: '84f54d33-cfb8-421f-8be5-533da5f0e127',
            status: 'PENDING' as const,
            lastError: null,
            updatedAt: '2026-02-25T10:01:00.000Z',
            refValue: 'MRKU2733926',
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true as const,
        allTerminal: false,
        requests: [
          {
            syncRequestId: '84f54d33-cfb8-421f-8be5-533da5f0e127',
            status: 'LEASED' as const,
            lastError: null,
            updatedAt: '2026-02-25T10:02:00.000Z',
            refValue: 'MRKU2733926',
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true as const,
        allTerminal: true,
        requests: [
          {
            syncRequestId: '84f54d33-cfb8-421f-8be5-533da5f0e127',
            status: 'DONE' as const,
            lastError: null,
            updatedAt: '2026-02-25T10:03:00.000Z',
            refValue: 'MRKU2733926',
          },
        ],
      })

    const result = await pollRefreshSyncStatus({
      syncRequestIds: ['84f54d33-cfb8-421f-8be5-533da5f0e127'],
      maxRetries: 5,
      initialDelayMs: 5000,
      fetchSyncStatus,
      sleep,
    })

    expect(result.kind).toBe('completed')
    expect(result.attempts).toBe(3)
    expect(sleep).toHaveBeenNthCalledWith(1, 5000)
    expect(sleep).toHaveBeenNthCalledWith(2, 10000)
    expect(sleep).toHaveBeenNthCalledWith(3, 20000)
    expect(fetchSyncStatus).toHaveBeenCalledTimes(3)
  })

  it('returns timeout when max retries are exhausted', async () => {
    const sleep = vi.fn(async () => undefined)
    const fetchSyncStatus = vi.fn(async () => ({
      ok: true as const,
      allTerminal: false,
      requests: [
        {
          syncRequestId: '954b82bc-06f6-4772-84b4-6f6a2c5e3397',
          status: 'PENDING' as const,
          lastError: null,
          updatedAt: '2026-02-25T10:00:00.000Z',
          refValue: 'MRKU2733926',
        },
      ],
    }))

    const result = await pollRefreshSyncStatus({
      syncRequestIds: ['954b82bc-06f6-4772-84b4-6f6a2c5e3397'],
      maxRetries: 5,
      initialDelayMs: 5000,
      fetchSyncStatus,
      sleep,
    })

    expect(result.kind).toBe('timeout')
    expect(result.attempts).toBe(5)
    expect(fetchSyncStatus).toHaveBeenCalledTimes(5)
    expect(sleep).toHaveBeenNthCalledWith(1, 5000)
    expect(sleep).toHaveBeenNthCalledWith(2, 10000)
    expect(sleep).toHaveBeenNthCalledWith(3, 20000)
    expect(sleep).toHaveBeenNthCalledWith(4, 40000)
    expect(sleep).toHaveBeenNthCalledWith(5, 80000)
  })

  it('treats FAILED and NOT_FOUND as terminal statuses', async () => {
    expect(isTerminalSyncStatus('FAILED')).toBe(true)
    expect(isTerminalSyncStatus('NOT_FOUND')).toBe(true)
    expect(isTerminalSyncStatus('DONE')).toBe(true)
    expect(isTerminalSyncStatus('PENDING')).toBe(false)
    expect(isTerminalSyncStatus('LEASED')).toBe(false)

    const fetchSyncStatus = vi.fn(async () => ({
      ok: true as const,
      allTerminal: true,
      requests: [
        {
          syncRequestId: '37cca430-0ace-42f8-a333-c8b1ca369967',
          status: 'FAILED' as const,
          lastError: 'provider_unavailable',
          updatedAt: '2026-02-25T10:07:00.000Z',
          refValue: 'MRKU2733926',
        },
        {
          syncRequestId: 'f64e9f2d-c996-4f1f-950f-ee813ba22b30',
          status: 'NOT_FOUND' as const,
          lastError: 'sync_request_not_found',
          updatedAt: null,
          refValue: null,
        },
      ],
    }))

    const result = await pollRefreshSyncStatus({
      syncRequestIds: [
        '37cca430-0ace-42f8-a333-c8b1ca369967',
        'f64e9f2d-c996-4f1f-950f-ee813ba22b30',
      ],
      maxRetries: 5,
      initialDelayMs: 5000,
      fetchSyncStatus,
      sleep: async () => undefined,
    })

    expect(result.kind).toBe('completed')
    expect(result.attempts).toBe(1)
  })
})
