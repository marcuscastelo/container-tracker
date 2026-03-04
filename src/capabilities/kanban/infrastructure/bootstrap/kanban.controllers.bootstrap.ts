import { createKanbanControllers } from '~/capabilities/kanban/interface/http/kanban.controllers'
import { processUseCases } from '~/modules/process/infrastructure/bootstrap/process.bootstrap'

export const kanbanControllers = createKanbanControllers({
  processUseCases,
})
