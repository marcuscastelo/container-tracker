import type {
  ProcessKanbanBoardProjection,
  ProcessKanbanItemProjection,
} from '~/capabilities/kanban/application/kanban.types'
import type { ProcessUseCases } from '~/modules/process/application/process.usecases'

export function createListProcessKanbanBoardUseCase(deps: {
  processUseCases: Pick<ProcessUseCases, 'listProcessesWithOperationalSummary'>
}) {
  return async function execute(): Promise<ProcessKanbanBoardProjection> {
    const result = await deps.processUseCases.listProcessesWithOperationalSummary()
    const items: ProcessKanbanItemProjection[] = result.processes.map(({ pwc, summary }) => ({
      processId: String(pwc.process.id),
      reference: pwc.process.reference ?? null,
      carrier: pwc.process.carrier ?? null,
      eta: summary.eta,
      operationalWorkflowState: pwc.process.operationalWorkflowState,
      containerCount: pwc.containers.length,
      statusSummary: summary.process_status,
      alertsCount: summary.alerts_count,
    }))

    return { items }
  }
}
