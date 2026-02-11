import type { ProcessRepository } from '~/modules/process/application/process.repository'

export type DeleteProcessCommand = {
  processId: string
}

export type DeleteProcessResult = {
  deleted: true
}

export function createDeleteProcessUseCase(deps: { repository: ProcessRepository }) {
  return async function execute(command: DeleteProcessCommand): Promise<DeleteProcessResult> {
    await deps.repository.delete(command.processId)
    return { deleted: true }
  }
}
