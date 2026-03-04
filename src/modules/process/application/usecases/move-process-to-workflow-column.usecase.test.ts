import { describe, expect, it, vi } from 'vitest'
import { createMoveProcessToWorkflowColumnUseCase } from '~/modules/process/application/usecases/move-process-to-workflow-column.usecase'
import { toCarrierCode } from '~/modules/process/domain/identity/carrier-code.vo'
import { toProcessId } from '~/modules/process/domain/identity/process-id.vo'
import { toProcessReference } from '~/modules/process/domain/identity/process-reference.vo'
import { toProcessSource } from '~/modules/process/domain/identity/process-source.vo'
import { createProcessEntity } from '~/modules/process/domain/process.entity'

describe('createMoveProcessToWorkflowColumnUseCase', () => {
  it('moves a process to a target workflow state', async () => {
    const process = createProcessEntity({
      id: toProcessId('a39c7e75-1f0d-4f8f-a14d-57d61bbf13cb'),
      reference: toProcessReference('PROC-001'),
      origin: null,
      destination: null,
      carrier: toCarrierCode('maersk'),
      billOfLading: null,
      bookingNumber: null,
      importerName: null,
      exporterName: null,
      referenceImporter: null,
      product: null,
      redestinationNumber: null,
      operationalWorkflowState: 'WAITING_BL',
      source: toProcessSource('manual'),
      createdAt: new Date('2026-03-04T10:00:00Z'),
      updatedAt: new Date('2026-03-04T10:00:00Z'),
    })

    const updated = createProcessEntity({
      ...process,
      operationalWorkflowState: 'LOADING',
    })

    const repository = {
      fetchAll: vi.fn(),
      fetchById: vi.fn().mockResolvedValue(process),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateWorkflowState: vi.fn().mockResolvedValue(updated),
    }

    const useCase = createMoveProcessToWorkflowColumnUseCase({ repository })
    const result = await useCase({
      processId: String(process.id),
      targetState: 'LOADING',
    })

    expect(repository.updateWorkflowState).toHaveBeenCalledWith(String(process.id), {
      operational_workflow_state: 'LOADING',
    })
    expect(result).toEqual({ processId: String(process.id), newState: 'LOADING' })
  })
})
