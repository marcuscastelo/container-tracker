import type { ProcessRepository } from '~/modules/process/application/process.repository'

type DeleteProcessCommand = {
  processId: string
}

type DeleteProcessResult = {
  deleted: true
}

export function createDeleteProcessUseCase(deps: { repository: ProcessRepository }) {
  return async function execute(command: DeleteProcessCommand): Promise<DeleteProcessResult> {
    await deps.repository.delete(command.processId)
    return { deleted: true }
  }
}
