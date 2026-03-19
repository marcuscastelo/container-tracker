import { describe, expect, it, vi } from 'vitest'
import { createNormalizeAutoCarriersUseCase } from '~/modules/process/application/usecases/normalize-auto-carriers.usecase'
import { toCarrierCode } from '~/modules/process/domain/identity/carrier-code.vo'
import { toProcessId } from '~/modules/process/domain/identity/process-id.vo'
import { toProcessReference } from '~/modules/process/domain/identity/process-reference.vo'
import { toProcessSource } from '~/modules/process/domain/identity/process-source.vo'
import { createProcessEntity } from '~/modules/process/domain/process.entity'
import { Instant } from '~/shared/time/instant'

function makeContainer(command: {
  readonly id: string
  readonly processId: string
  readonly containerNumber: string
  readonly carrierCode: string | null
  readonly carrierAssignmentMode: 'AUTO' | 'MANUAL'
}) {
  // Use a plain test fixture object instead of importing cross-BC domain constructors
  return {
    id: command.id,
    processId: command.processId,
    containerNumber: command.containerNumber,
    carrierCode: command.carrierCode ?? null,
    carrierAssignmentMode: command.carrierAssignmentMode,
    createdAt: Instant.fromIso('2026-03-01T10:00:00.000Z'),
  }
}

describe('normalize-auto-carriers.usecase', () => {
  it('normalizes only AUTO containers and preserves MANUAL carriers', async () => {
    const process = createProcessEntity({
      id: toProcessId('process-1'),
      reference: toProcessReference('REF-1'),
      origin: 'Shanghai',
      destination: 'Santos',
      carrierMode: 'AUTO',
      defaultCarrierCode: toCarrierCode('msc'),
      carrier: toCarrierCode('msc'),
      billOfLading: null,
      bookingNumber: null,
      importerName: null,
      exporterName: null,
      referenceImporter: null,
      product: null,
      redestinationNumber: null,
      source: toProcessSource('manual'),
      createdAt: Instant.fromIso('2026-03-01T10:00:00.000Z'),
      updatedAt: Instant.fromIso('2026-03-01T10:00:00.000Z'),
    })

    const stateContainers = [
      makeContainer({
        id: 'container-1',
        processId: 'process-1',
        containerNumber: 'MSCU1234567',
        carrierCode: 'maersk',
        carrierAssignmentMode: 'AUTO',
      }),
      makeContainer({
        id: 'container-2',
        processId: 'process-1',
        containerNumber: 'MSCU7654321',
        carrierCode: 'msc',
        carrierAssignmentMode: 'AUTO',
      }),
      makeContainer({
        id: 'container-3',
        processId: 'process-1',
        containerNumber: 'CMAU1945069',
        carrierCode: 'cmacgm',
        carrierAssignmentMode: 'MANUAL',
      }),
    ]

    const repository = {
      fetchAll: vi.fn(async () => []),
      fetchById: vi.fn(async () => process),
      create: vi.fn(async () => process),
      update: vi.fn(async () => process),
      delete: vi.fn(async () => undefined),
    }
    const updateCarrier = vi.fn(async (command: { readonly containerId: string }) => {
      const index = stateContainers.findIndex(
        (container) => String(container.id) === command.containerId,
      )
      const previous = index >= 0 ? stateContainers[index] : stateContainers[0]
      if (!previous) {
        throw new Error('container_not_found')
      }

      const updated = makeContainer({
        id: String(previous.id),
        processId: String(previous.processId),
        containerNumber: String(previous.containerNumber),
        carrierCode: 'msc',
        carrierAssignmentMode: previous.carrierAssignmentMode ?? 'AUTO',
      })
      if (index >= 0) {
        stateContainers[index] = updated
      }
      return updated
    })

    const execute = createNormalizeAutoCarriersUseCase({
      repository,
      containerUseCases: {
        listByProcessId: vi.fn(async () => ({ containers: stateContainers })),
        updateCarrier,
      },
    })

    const result = await execute({ processId: 'process-1' })

    expect(result).toMatchObject({
      ok: true,
      process_id: 'process-1',
      normalized: true,
      reason: 'normalized',
      target_carrier_code: 'msc',
      updated_auto_containers: 1,
      skipped_manual_containers: 1,
      already_aligned_auto_containers: 1,
      after_summary: 'MIXED',
    })
    expect(updateCarrier).toHaveBeenCalledTimes(1)
    expect(updateCarrier).toHaveBeenCalledWith(
      expect.objectContaining({
        containerId: 'container-1',
        carrierCode: 'msc',
        carrierAssignmentMode: 'AUTO',
      }),
    )
    expect(repository.update).toHaveBeenCalledWith(
      'process-1',
      expect.objectContaining({
        carrier_mode: 'AUTO',
        default_carrier_code: 'msc',
        last_resolved_carrier_code: 'msc',
      }),
    )
  })

  it('does not normalize when a deterministic target carrier is unavailable', async () => {
    const process = createProcessEntity({
      id: toProcessId('process-2'),
      reference: toProcessReference('REF-2'),
      origin: 'Shanghai',
      destination: 'Santos',
      carrierMode: 'AUTO',
      defaultCarrierCode: null,
      carrier: null,
      billOfLading: null,
      bookingNumber: null,
      importerName: null,
      exporterName: null,
      referenceImporter: null,
      product: null,
      redestinationNumber: null,
      source: toProcessSource('manual'),
      createdAt: Instant.fromIso('2026-03-01T10:00:00.000Z'),
      updatedAt: Instant.fromIso('2026-03-01T10:00:00.000Z'),
    })

    const repository = {
      fetchAll: vi.fn(async () => []),
      fetchById: vi.fn(async () => process),
      create: vi.fn(async () => process),
      update: vi.fn(async () => process),
      delete: vi.fn(async () => undefined),
    }
    const updateCarrier = vi.fn(async () =>
      makeContainer({
        id: 'container-1',
        processId: 'process-2',
        containerNumber: 'MSCU1234567',
        carrierCode: 'msc',
        carrierAssignmentMode: 'AUTO',
      }),
    )

    const execute = createNormalizeAutoCarriersUseCase({
      repository,
      containerUseCases: {
        listByProcessId: vi.fn(async () => ({
          containers: [
            makeContainer({
              id: 'container-1',
              processId: 'process-2',
              containerNumber: 'MSCU1234567',
              carrierCode: 'msc',
              carrierAssignmentMode: 'AUTO',
            }),
            makeContainer({
              id: 'container-2',
              processId: 'process-2',
              containerNumber: 'MRKU7654321',
              carrierCode: 'maersk',
              carrierAssignmentMode: 'AUTO',
            }),
          ],
        })),
        updateCarrier,
      },
    })

    const result = await execute({ processId: 'process-2' })

    expect(result).toMatchObject({
      ok: true,
      process_id: 'process-2',
      normalized: false,
      reason: 'target_carrier_not_resolved',
      target_carrier_code: null,
      before_summary: 'MIXED',
      after_summary: 'MIXED',
    })
    expect(updateCarrier).not.toHaveBeenCalled()
    expect(repository.update).not.toHaveBeenCalled()
  })

  it('never auto-promotes default carrier for MANUAL process mode', async () => {
    const process = createProcessEntity({
      id: toProcessId('process-3'),
      reference: toProcessReference('REF-3'),
      origin: 'Shanghai',
      destination: 'Santos',
      carrierMode: 'MANUAL',
      defaultCarrierCode: toCarrierCode('msc'),
      carrier: toCarrierCode('msc'),
      billOfLading: null,
      bookingNumber: null,
      importerName: null,
      exporterName: null,
      referenceImporter: null,
      product: null,
      redestinationNumber: null,
      source: toProcessSource('manual'),
      createdAt: Instant.fromIso('2026-03-01T10:00:00.000Z'),
      updatedAt: Instant.fromIso('2026-03-01T10:00:00.000Z'),
    })

    const repository = {
      fetchAll: vi.fn(async () => []),
      fetchById: vi.fn(async () => process),
      create: vi.fn(async () => process),
      update: vi.fn(async () => process),
      delete: vi.fn(async () => undefined),
    }
    const updateCarrier = vi.fn(async () =>
      makeContainer({
        id: 'container-1',
        processId: 'process-3',
        containerNumber: 'MSCU1234567',
        carrierCode: 'msc',
        carrierAssignmentMode: 'AUTO',
      }),
    )

    const execute = createNormalizeAutoCarriersUseCase({
      repository,
      containerUseCases: {
        listByProcessId: vi.fn(async () => ({
          containers: [
            makeContainer({
              id: 'container-1',
              processId: 'process-3',
              containerNumber: 'MSCU1234567',
              carrierCode: 'maersk',
              carrierAssignmentMode: 'AUTO',
            }),
            makeContainer({
              id: 'container-2',
              processId: 'process-3',
              containerNumber: 'MSCU7654321',
              carrierCode: 'msc',
              carrierAssignmentMode: 'AUTO',
            }),
          ],
        })),
        updateCarrier,
      },
    })

    const result = await execute({ processId: 'process-3' })

    expect(result?.normalized).toBe(true)
    expect(updateCarrier).toHaveBeenCalledTimes(1)
    expect(repository.update).not.toHaveBeenCalled()
  })
})
