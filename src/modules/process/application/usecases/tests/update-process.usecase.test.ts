import { describe, expect, it, vi } from 'vitest'
import type { ProcessContainerRecord } from '~/modules/process/application/process.readmodels'
import type { ProcessRepository } from '~/modules/process/application/process.repository'
import { createUpdateProcessUseCase } from '~/modules/process/application/usecases/update-process.usecase'
import { toCarrierCode } from '~/modules/process/domain/identity/carrier-code.vo'
import { toProcessId } from '~/modules/process/domain/identity/process-id.vo'
import { toProcessReference } from '~/modules/process/domain/identity/process-reference.vo'
import { toProcessSource } from '~/modules/process/domain/identity/process-source.vo'
import { createProcessEntity } from '~/modules/process/domain/process.entity'
import { Instant } from '~/shared/time/instant'

function createProcess() {
  return createProcessEntity({
    id: toProcessId('process-1'),
    reference: toProcessReference('REF-1'),
    origin: 'Karachi',
    destination: 'Santos',
    carrier: toCarrierCode('one'),
    billOfLading: null,
    bookingNumber: null,
    importerName: null,
    exporterName: null,
    referenceImporter: null,
    product: null,
    redestinationNumber: null,
    source: toProcessSource('manual'),
    createdAt: Instant.fromIso('2026-04-02T10:00:00.000Z'),
    updatedAt: Instant.fromIso('2026-04-02T10:00:00.000Z'),
  })
}

function createRepository(): ProcessRepository {
  const process = createProcess()

  return {
    fetchAll: vi.fn(async () => [process]),
    fetchById: vi.fn(async () => process),
    create: vi.fn(async () => process),
    update: vi.fn(async () => process),
    delete: vi.fn(async () => undefined),
  }
}

describe('update-process.usecase', () => {
  it('propagates a carrier-only patch to existing containers so sync resolution stays aligned', async () => {
    const repository = createRepository()
    const existingContainers: readonly ProcessContainerRecord[] = [
      {
        id: 'container-1',
        processId: 'process-1',
        containerNumber: 'DRYU2434190',
        carrierCode: 'unknown',
      },
    ]

    const listByProcessId = vi.fn(async () => ({
      containers: existingContainers,
    }))
    const reconcileForProcess = vi.fn(async () => ({
      added: [],
      updated: [],
      removed: [],
      warnings: [],
    }))

    const updateProcess = createUpdateProcessUseCase({
      repository,
      containerUseCases: {
        listByProcessId,
        reconcileForProcess,
      },
    })

    await updateProcess({
      processId: 'process-1',
      record: { carrier: 'one' },
    })

    expect(reconcileForProcess).toHaveBeenCalledWith({
      processId: 'process-1',
      existing: [
        {
          id: 'container-1',
          containerNumber: 'DRYU2434190',
          carrierCode: 'unknown',
        },
      ],
      incoming: [
        {
          containerNumber: 'DRYU2434190',
          carrierCode: 'one',
        },
      ],
    })
    expect(repository.update).toHaveBeenCalledWith('process-1', { carrier: 'one' })
  })
})
