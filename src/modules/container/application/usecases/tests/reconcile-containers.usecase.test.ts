import { describe, expect, it, vi } from 'vitest'
import type {
  ContainerRepository,
  InsertContainerRecord,
} from '~/modules/container/application/container.repository'
import { createReconcileContainersUseCase } from '~/modules/container/application/usecases/reconcile-containers.usecase'
import { createContainerEntity } from '~/modules/container/domain/container.entity'
import { toCarrierCode } from '~/modules/container/domain/identity/carrier-code.vo'
import { toContainerId } from '~/modules/container/domain/identity/container-id.vo'
import { toContainerNumber } from '~/modules/container/domain/identity/container-number.vo'
import { toProcessId } from '~/modules/container/domain/identity/process-id.vo'
import { DuplicateContainersError } from '~/shared/errors/container-process.errors'

function createInsertedEntity(record: InsertContainerRecord, id: string) {
  return createContainerEntity({
    id: toContainerId(id),
    processId: toProcessId(record.processId),
    carrierCode: toCarrierCode(record.carrierCode),
    containerNumber: toContainerNumber(record.containerNumber),
    createdAt: new Date('2026-03-09T10:00:00.000Z'),
  })
}

function createContainerRepositoryDouble() {
  const inserted: InsertContainerRecord[] = []
  const deleted: string[] = []
  let insertCounter = 0

  const repository: ContainerRepository = {
    insert: vi.fn(async (record) => {
      inserted.push(record)
      insertCounter += 1
      return createInsertedEntity(record, `inserted-${insertCounter}`)
    }),
    insertMany: vi.fn(async () => []),
    updateCarrierCode: vi.fn(async () => {
      throw new Error('Not implemented in reconcile tests')
    }),
    delete: vi.fn(async (id) => {
      deleted.push(id)
    }),
    existsMany: vi.fn(async () => new Map()),
    findByNumber: vi.fn(async () => null),
    findByNumbers: vi.fn(async () => []),
    listSearchProjections: vi.fn(async () => []),
    listByProcessId: vi.fn(async () => []),
    listByProcessIds: vi.fn(async () => new Map()),
  }

  return { repository, inserted, deleted }
}

describe('reconcile-containers.usecase', () => {
  it('reconciles additions and removals based on final incoming payload', async () => {
    const { repository, inserted, deleted } = createContainerRepositoryDouble()
    const reconcile = createReconcileContainersUseCase({ repository })

    const result = await reconcile({
      processId: 'process-1',
      existing: [
        { id: 'container-a', containerNumber: 'MSCU1111111' },
        { id: 'container-b', containerNumber: 'MSCU2222222' },
      ],
      incoming: [
        { containerNumber: 'MSCU1111111', carrierCode: 'MSC' },
        { containerNumber: 'MSCU3333333', carrierCode: 'MSC' },
      ],
    })

    expect(inserted).toEqual([
      {
        processId: 'process-1',
        containerNumber: 'MSCU3333333',
        carrierCode: 'MSC',
      },
    ])
    expect(deleted).toEqual(['container-b'])
    expect(result.removed).toEqual(['container-b'])
    expect(result.added).toHaveLength(1)
  })

  it('allows re-adding a container that was removed in a prior reconciliation', async () => {
    const { repository, inserted, deleted } = createContainerRepositoryDouble()
    const reconcile = createReconcileContainersUseCase({ repository })

    await reconcile({
      processId: 'process-1',
      existing: [
        { id: 'container-a', containerNumber: 'MSCU1111111' },
        { id: 'container-b', containerNumber: 'MSCU2222222' },
      ],
      incoming: [{ containerNumber: 'MSCU1111111', carrierCode: 'MSC' }],
    })

    await reconcile({
      processId: 'process-1',
      existing: [{ id: 'container-a', containerNumber: 'MSCU1111111' }],
      incoming: [
        { containerNumber: 'MSCU1111111', carrierCode: 'MSC' },
        { containerNumber: 'MSCU2222222', carrierCode: 'MSC' },
      ],
    })

    expect(deleted).toEqual(['container-b'])
    expect(inserted).toEqual([
      {
        processId: 'process-1',
        containerNumber: 'MSCU2222222',
        carrierCode: 'MSC',
      },
    ])
  })

  it('rejects duplicate container numbers in the final incoming payload', async () => {
    const { repository } = createContainerRepositoryDouble()
    const reconcile = createReconcileContainersUseCase({ repository })

    await expect(
      reconcile({
        processId: 'process-1',
        existing: [
          { id: 'container-a', containerNumber: 'MSCU1111111' },
          { id: 'container-b', containerNumber: 'MSCU2222222' },
        ],
        incoming: [
          { containerNumber: 'MSCU1111111', carrierCode: 'MSC' },
          { containerNumber: 'mscu1111111', carrierCode: 'MSC' },
        ],
      }),
    ).rejects.toBeInstanceOf(DuplicateContainersError)
  })
})
