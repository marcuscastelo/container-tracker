import { describe, expect, it, vi } from 'vitest'
import type { SyncMetadataRecord } from '~/modules/tracking/application/ports/tracking.sync-metadata.repository'
import {
  createGetContainersSyncMetadataUseCase,
  normalizeContainerNumber,
} from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'

function makeRow(overrides: Partial<SyncMetadataRecord> = {}): SyncMetadataRecord {
  return {
    containerNumber: 'MSCU1234567',
    provider: 'msc',
    status: 'PENDING',
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
    lastError: null,
    ...overrides,
  }
}

describe('get-containers-sync-metadata use case', () => {
  it('aggregates attempt/success/error/syncing and preserves input order', async () => {
    const listByContainerNumbers = vi.fn(async () => [
      makeRow({
        containerNumber: 'MSCU1234567',
        provider: 'msc',
        status: 'DONE',
        createdAt: '2026-03-01T10:00:00.000Z',
        updatedAt: '2026-03-01T10:20:00.000Z',
      }),
      makeRow({
        containerNumber: 'MSCU1234567',
        provider: 'msc',
        status: 'FAILED',
        createdAt: '2026-03-02T10:00:00.000Z',
        updatedAt: '2026-03-02T10:10:00.000Z',
        lastError: 'timeout',
      }),
      makeRow({
        containerNumber: 'MSCU1234567',
        provider: 'maersk',
        status: 'PENDING',
        createdAt: '2026-03-03T10:00:00.000Z',
        updatedAt: '2026-03-03T10:00:00.000Z',
      }),
      makeRow({
        containerNumber: 'MSCU7654321',
        provider: 'msc',
        status: 'DONE',
        createdAt: '2026-03-01T09:00:00.000Z',
        updatedAt: '2026-03-01T09:30:00.000Z',
      }),
    ])

    const useCase = createGetContainersSyncMetadataUseCase({
      syncMetadataRepository: {
        listByContainerNumbers,
      },
    })

    const result = await useCase({
      containerNumbers: ['MSCU7654321', '  mscu1234567  '],
    })

    expect(result).toEqual([
      {
        containerNumber: 'MSCU7654321',
        carrier: 'msc',
        lastSuccessAt: '2026-03-01T09:30:00.000Z',
        lastAttemptAt: '2026-03-01T09:00:00.000Z',
        isSyncing: false,
        lastErrorCode: null,
        lastErrorAt: null,
      },
      {
        containerNumber: 'MSCU1234567',
        carrier: 'maersk',
        lastSuccessAt: '2026-03-01T10:20:00.000Z',
        lastAttemptAt: '2026-03-03T10:00:00.000Z',
        isSyncing: true,
        lastErrorCode: 'timeout',
        lastErrorAt: '2026-03-02T10:10:00.000Z',
      },
    ])

    expect(listByContainerNumbers).toHaveBeenCalledWith({
      containerNumbers: ['MSCU7654321', 'MSCU1234567'],
    })
  })

  it('normalizes values and returns deterministic fallback when there is no history', async () => {
    const useCase = createGetContainersSyncMetadataUseCase({
      syncMetadataRepository: {
        listByContainerNumbers: vi.fn(async () => []),
      },
    })

    const result = await useCase({
      containerNumbers: [' mscu0000001 ', 'MSCU0000002'],
    })

    expect(result).toEqual([
      {
        containerNumber: 'MSCU0000001',
        carrier: null,
        lastSuccessAt: null,
        lastAttemptAt: null,
        isSyncing: false,
        lastErrorCode: null,
        lastErrorAt: null,
      },
      {
        containerNumber: 'MSCU0000002',
        carrier: null,
        lastSuccessAt: null,
        lastAttemptAt: null,
        isSyncing: false,
        lastErrorCode: null,
        lastErrorAt: null,
      },
    ])
  })

  it('normalizes container number helper to uppercase and trimmed', () => {
    expect(normalizeContainerNumber('  mscu1234567  ')).toBe('MSCU1234567')
  })
})
