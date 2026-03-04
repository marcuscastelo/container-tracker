import type { OperationalWorkflowState } from '~/modules/process/domain/operational-workflow-state.vo'

export type InsertProcessRecord = Readonly<{
  reference: string | null
  origin?: string | null
  destination?: string | null
  carrier: string
  bill_of_lading: string | null
  booking_number: string | null
  importer_name: string | null
  exporter_name: string | null
  reference_importer: string | null
  product?: string | null
  redestination_number?: string | null
  operational_workflow_state?: OperationalWorkflowState
  source: string
}>

export type UpdateProcessRecord = Readonly<{
  reference?: string
  origin?: string | null
  destination?: string | null
  carrier?: string
  bill_of_lading?: string
  booking_number?: string
  importer_name?: string
  exporter_name?: string
  reference_importer?: string
  product?: string | null
  redestination_number?: string | null
  source?: string
}>

export type UpdateProcessWorkflowRecord = Readonly<{
  operational_workflow_state: OperationalWorkflowState
}>
