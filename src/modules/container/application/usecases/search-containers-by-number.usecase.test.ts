import { describe, expect, it, vi } from 'vitest'

import type { ContainerSearchProjection } from '~/modules/container/application/container.readmodels'
import type {
  ContainerRepository,
  InsertContainerRecord,
} from '~/modules/container/application/container.repository'
import { createSearchContainersByNumberUseCase } from '~/modules/container/application/usecases/search-containers-by-number.usecase'
import type { ContainerEntity } from '~/modules/container/domain/container.entity'

function createRepository(projections: readonly ContainerSearchProjection[]): ContainerRepository {
  return {
    insert: vi.fn(async (_record: InsertContainerRecord): Promise<ContainerEntity> => {
      throw new Error('Not implemented in search tests')
    }),
    insertMany: vi.fn(async (_records: InsertContainerRecord[]): Promise<ContainerEntity[]> => {
      throw new Error('Not implemented in search tests')
    }),
    delete: vi.fn(async (_id: string): Promise<void> => {
      throw new Error('Not implemented in search tests')
    }),
    existsMany: vi.fn(async (_numbers: string[]): Promise<Map<string, boolean>> => {
      throw new Error('Not implemented in search tests')
    }),
    findByNumber: vi.fn(async (_containerNumber: string): Promise<ContainerEntity | null> => {
      throw new Error('Not implemented in search tests')
    }),
    findByNumbers: vi.fn(async (_numbers: string[]): Promise<ContainerEntity[]> => {
      throw new Error('Not implemented in search tests')
    }),
    listSearchProjections: vi.fn(async () => projections),
    listByProcessId: vi.fn(async (_processId: string): Promise<readonly ContainerEntity[]> => {
      throw new Error('Not implemented in search tests')
    }),
    listByProcessIds: vi.fn(
      async (
        _processIds: readonly string[],
      ): Promise<ReadonlyMap<string, readonly ContainerEntity[]>> => {
        throw new Error('Not implemented in search tests')
      },
    ),
  }
}

describe('createSearchContainersByNumberUseCase', () => {
  it('supports exact and partial case-insensitive matches', async () => {
    const repository = createRepository([
      { processId: 'process-exact', containerNumber: 'MRKU1234567' },
      { processId: 'process-partial', containerNumber: 'MSCU9123456' },
      { processId: 'process-other', containerNumber: 'TGHU0000000' },
    ])

    const searchByNumber = createSearchContainersByNumberUseCase({ repository })

    const exactMatch = await searchByNumber('mrku1234567', 10)
    const partialMatch = await searchByNumber(' cU91 ', 10)

    expect(exactMatch).toEqual([
      {
        processId: 'process-exact',
        containerNumber: 'MRKU1234567',
      },
    ])

    expect(partialMatch).toEqual([
      {
        processId: 'process-partial',
        containerNumber: 'MSCU9123456',
      },
    ])
  })

  it('respects the limit after matching', async () => {
    const repository = createRepository([
      { processId: 'process-1', containerNumber: 'MSCU1000001' },
      { processId: 'process-2', containerNumber: 'MSCU1000002' },
      { processId: 'process-3', containerNumber: 'MSCU1000003' },
    ])

    const searchByNumber = createSearchContainersByNumberUseCase({ repository })

    const result = await searchByNumber('mscu1', 2)

    expect(result).toEqual([
      { processId: 'process-1', containerNumber: 'MSCU1000001' },
      { processId: 'process-2', containerNumber: 'MSCU1000002' },
    ])
  })

  it('applies process limit before truncating container matches', async () => {
    const repository = createRepository([
      { processId: 'process-1', containerNumber: 'MSCU1000001' },
      { processId: 'process-1', containerNumber: 'MSCU1000002' },
      { processId: 'process-2', containerNumber: 'MSCU1000003' },
      { processId: 'process-3', containerNumber: 'MSCU1000004' },
    ])

    const searchByNumber = createSearchContainersByNumberUseCase({ repository })

    const result = await searchByNumber('mscu1', 2)

    expect(result).toEqual([
      { processId: 'process-1', containerNumber: 'MSCU1000001' },
      { processId: 'process-1', containerNumber: 'MSCU1000002' },
      { processId: 'process-2', containerNumber: 'MSCU1000003' },
    ])
  })

  it('returns empty results for empty query or non-positive limit without calling repository', async () => {
    const listSearchProjections = vi.fn(async () => [
      { processId: 'process-1', containerNumber: 'MSCU1000001' },
    ])

    const repository = createRepository([])
    repository.listSearchProjections = listSearchProjections
    const searchByNumber = createSearchContainersByNumberUseCase({ repository })

    const emptyQueryResult = await searchByNumber('   ', 10)
    const nonPositiveLimitResult = await searchByNumber('mscu', 0)

    expect(emptyQueryResult).toEqual([])
    expect(nonPositiveLimitResult).toEqual([])
    expect(listSearchProjections).not.toHaveBeenCalled()
  })
})
