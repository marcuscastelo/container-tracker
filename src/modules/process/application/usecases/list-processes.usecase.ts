import type { ProcessRepository } from '~/modules/process/application/process.repository'
import type { Process } from '~/modules/process/domain/process'

export type ListProcessesCommand = never

export type ListProcessesResult = {
  processes: readonly Process[]
}

export function createListProcessesUseCase(deps: { repository: ProcessRepository }) {
  return async function execute(): Promise<ListProcessesResult> {
    const processes = await deps.repository.fetchAll()
    return { processes }
  }
}
