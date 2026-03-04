export const OPERATIONAL_WORKFLOW_STATES = [
  'WAITING_BL',
  'ARRIVAL_FORECAST',
  'DELAYED_WAITING_CUSTOMS_PRESENCE',
  'WAITING_FUNDS',
  'WAITING_ICMS',
  'LOADING',
  'INVOICING',
] as const

export type OperationalWorkflowState = (typeof OPERATIONAL_WORKFLOW_STATES)[number]

export const DEFAULT_OPERATIONAL_WORKFLOW_STATE: OperationalWorkflowState = 'WAITING_BL'

export function isOperationalWorkflowState(value: string): value is OperationalWorkflowState {
  return OPERATIONAL_WORKFLOW_STATES.some((state) => state === value)
}
