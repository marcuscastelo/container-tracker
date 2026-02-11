import type { ProcessRepository } from '~/modules/process/application/process.repository'
import type { Process } from '~/modules/process/domain/process'

export type FindProcessByIdCommand = {
  processId: string
}

export type FindProcessByIdResult = {
  process: Process | null
}

export function createFindProcessByIdUseCase(deps: { repository: ProcessRepository }) {
  return async function execute(command: FindProcessByIdCommand): Promise<FindProcessByIdResult> {
    const process = await deps.repository.fetchById(command.processId)
    return { process }
  }
}
