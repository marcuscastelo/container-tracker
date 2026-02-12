import type { ProcessRepository } from '~/modules/process/application/process.repository'
import type { ProcessEntity } from '~/modules/process/domain/process.entity'

export type ListProcessesCommand = never

export type ListProcessesResult = {
  processes: readonly ProcessEntity[]
}

export function createListProcessesUseCase(deps: { repository: ProcessRepository }) {
  return async function execute(): Promise<ListProcessesResult> {
    const processes = await deps.repository.fetchAll()
    return { processes }
  }
}
