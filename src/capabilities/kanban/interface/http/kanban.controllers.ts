import { createListProcessKanbanBoardUseCase } from '~/capabilities/kanban/application/list-process-kanban-board.usecase'
import type { ProcessUseCases } from '~/modules/process/application/process.usecases'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'

export function createKanbanControllers(deps: {
  processUseCases: Pick<ProcessUseCases, 'listProcessesWithOperationalSummary'>
}) {
  const listBoardUseCase = createListProcessKanbanBoardUseCase({
    processUseCases: deps.processUseCases,
  })

  async function listBoard(): Promise<Response> {
    try {
      const result = await listBoardUseCase()
      return jsonResponse(result, 200)
    } catch (err) {
      console.error('GET /api/kanban/processes error:', err)
      return mapErrorToResponse(err)
    }
  }

  return { listBoard }
}
