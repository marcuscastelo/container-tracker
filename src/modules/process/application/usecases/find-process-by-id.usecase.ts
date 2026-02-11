import type { ProcessRepository } from '~/modules/process/application/process.repository'
import type { ProcessEntity } from '~/modules/process/domain/process.entity'

export type FindProcessByIdCommand = {
  processId: string
}

export type FindProcessByIdResult = {
  process: ProcessEntity | null
}

export function createFindProcessByIdUseCase(deps: { repository: ProcessRepository }) {
  return async function execute(command: FindProcessByIdCommand): Promise<FindProcessByIdResult> {
    const process = await deps.repository.fetchById(command.processId)
    return { process }
  }
}
