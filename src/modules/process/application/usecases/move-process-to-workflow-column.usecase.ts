import type { ProcessRepository } from '~/modules/process/application/process.repository'
import type { OperationalWorkflowState } from '~/modules/process/domain/operational-workflow-state.vo'

export type MoveProcessWorkflowCommand = Readonly<{
  processId: string
  targetState: OperationalWorkflowState
}>

export type MoveProcessWorkflowResult = Readonly<{
  processId: string
  newState: OperationalWorkflowState
}>

export function createMoveProcessToWorkflowColumnUseCase(deps: { repository: ProcessRepository }) {
  return async function execute(
    command: MoveProcessWorkflowCommand,
  ): Promise<MoveProcessWorkflowResult> {
    const process = await deps.repository.fetchById(command.processId)
    if (!process) {
      throw new Error('Process not found')
    }

    const updated = await deps.repository.updateWorkflowState(command.processId, {
      operational_workflow_state: command.targetState,
    })

    return {
      processId: String(updated.id),
      newState: updated.operationalWorkflowState,
    }
  }
}
