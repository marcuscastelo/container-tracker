import { describe, expect, it, vi } from 'vitest'

import type {
  ContainerRepository,
  InsertContainerRecord,
} from '~/modules/container/application/container.repository'
import { createFindContainersByNumberUseCase } from '~/modules/container/application/usecases/find-containers-by-number.usecase'
import {
  type ContainerEntity,
  createContainerEntity,
} from '~/modules/container/domain/container.entity'
import { toCarrierCode } from '~/modules/container/domain/identity/carrier-code.vo'
import { toContainerId } from '~/modules/container/domain/identity/container-id.vo'
import { toContainerNumber } from '~/modules/container/domain/identity/container-number.vo'
import { toProcessId } from '~/modules/container/domain/identity/process-id.vo'

function createRepository(overrides: {
  readonly findByNumbers: ContainerRepository['findByNumbers']
}): ContainerRepository {
  return {
    insert: vi.fn(async (_record: InsertContainerRecord): Promise<ContainerEntity> => {
      throw new Error('Not implemented in findByNumbers tests')
    }),
    insertMany: vi.fn(async (_records: InsertContainerRecord[]): Promise<ContainerEntity[]> => {
      throw new Error('Not implemented in findByNumbers tests')
    }),
    updateCarrierCode: vi.fn(
      async (_command: {
        readonly id: string
        readonly carrierCode: string
      }): Promise<ContainerEntity> => {
        throw new Error('Not implemented in findByNumbers tests')
      },
    ),
    delete: vi.fn(async (_id: string): Promise<void> => {
      throw new Error('Not implemented in findByNumbers tests')
    }),
    existsMany: vi.fn(async (_numbers: string[]): Promise<Map<string, boolean>> => {
      throw new Error('Not implemented in findByNumbers tests')
    }),
    findByNumber: vi.fn(async (_containerNumber: string): Promise<ContainerEntity | null> => {
      throw new Error('Not implemented in findByNumbers tests')
    }),
    findByNumbers: overrides.findByNumbers,
    listSearchProjections: vi.fn(async () => {
      throw new Error('Not implemented in findByNumbers tests')
    }),
    listByProcessId: vi.fn(async (_processId: string): Promise<readonly ContainerEntity[]> => {
      throw new Error('Not implemented in findByNumbers tests')
    }),
    listByProcessIds: vi.fn(
      async (
        _processIds: readonly string[],
      ): Promise<ReadonlyMap<string, readonly ContainerEntity[]>> => {
        throw new Error('Not implemented in findByNumbers tests')
      },
    ),
  }
}

describe('createFindContainersByNumberUseCase', () => {
  it('keeps exact lookup behavior by normalizing numbers before repository search', async () => {
    const existing = createContainerEntity({
      id: toContainerId('container-1'),
      processId: toProcessId('process-1'),
      carrierCode: toCarrierCode('MAERSK'),
      containerNumber: toContainerNumber('MRKU1234567'),
      createdAt: new Date('2026-03-03T00:00:00.000Z'),
    })

    const findByNumbers = vi.fn(async (numbers: string[]) => {
      if (numbers.includes('MRKU1234567')) {
        return [existing]
      }
      return []
    })

    const repository = createRepository({ findByNumbers })
    const findContainersByNumber = createFindContainersByNumberUseCase({ repository })

    const result = await findContainersByNumber({ containerNumbers: ['  mrku1234567 '] })

    expect(findByNumbers).toHaveBeenCalledWith(['MRKU1234567'])
    expect(result.containers).toEqual([existing])
  })
})
