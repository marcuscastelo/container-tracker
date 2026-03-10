import { describe, expect, it, vi } from 'vitest'

import type {
  InsertProcessRecord,
  UpdateProcessRecord,
} from '~/modules/process/application/process.records'
import type { ProcessRepository } from '~/modules/process/application/process.repository'
import { createDeleteProcessUseCase } from '~/modules/process/application/usecases/delete-process.usecase'

function createRepository(command?: {
  readonly delete?: ProcessRepository['delete']
}): ProcessRepository {
  return {
    fetchAll: vi.fn(async () => []),
    fetchById: vi.fn(async (_processId: string) => null),
    create: vi.fn(async (_record: InsertProcessRecord) => {
      throw new Error('Not implemented in delete process use case tests')
    }),
    update: vi.fn(async (_processId: string, _record: UpdateProcessRecord) => {
      throw new Error('Not implemented in delete process use case tests')
    }),
    delete: command?.delete ?? vi.fn(async (_processId: string) => {}),
  }
}

describe('createDeleteProcessUseCase', () => {
  it('deletes an existing process', async () => {
    const deleteSpy = vi.fn(async (_processId: string) => {})
    const repository = createRepository({ delete: deleteSpy })
    const deleteProcess = createDeleteProcessUseCase({ repository })

    const result = await deleteProcess({ processId: 'process-1' })

    expect(deleteSpy).toHaveBeenCalledTimes(1)
    expect(deleteSpy).toHaveBeenCalledWith('process-1')
    expect(result).toEqual({ deleted: true })
  })

  it('throws when repository deletion fails', async () => {
    const repository = createRepository({
      delete: vi.fn(async (_processId: string) => {
        throw new Error('database delete failed')
      }),
    })
    const deleteProcess = createDeleteProcessUseCase({ repository })

    await expect(deleteProcess({ processId: 'process-1' })).rejects.toThrow(
      'database delete failed',
    )
  })
})
