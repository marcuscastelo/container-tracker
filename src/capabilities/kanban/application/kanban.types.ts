export type OperationalWorkflowStateDto =
  | 'WAITING_BL'
  | 'ARRIVAL_FORECAST'
  | 'DELAYED_WAITING_CUSTOMS_PRESENCE'
  | 'WAITING_FUNDS'
  | 'WAITING_ICMS'
  | 'LOADING'
  | 'INVOICING'

export type ProcessKanbanItemProjection = Readonly<{
  processId: string
  reference: string | null
  carrier: string | null
  eta: string | null
  operationalWorkflowState: OperationalWorkflowStateDto
  containerCount: number
  statusSummary: string | null
  alertsCount: number
}>

export type ProcessKanbanBoardProjection = Readonly<{
  items: readonly ProcessKanbanItemProjection[]
}>
