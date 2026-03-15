import type { ProcessRepository } from '~/modules/process/application/process.repository'

type UpdateProcessCarrierCommand = {
  readonly processId: string
  readonly carrier: string
}

export function createUpdateProcessCarrierUseCase(deps: { repository: ProcessRepository }) {
  return async function execute(command: UpdateProcessCarrierCommand) {
    return deps.repository.update(command.processId, {
      carrier: command.carrier,
    })
  }
}
