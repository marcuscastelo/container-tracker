import type { ProcessEntity } from '~/modules/process/domain/process.entity'

export type ProcessContainerRecord = Readonly<{
  id: string
  processId: string
  containerNumber: string
  carrierCode: string | null
}>

export type ProcessWithContainers = Readonly<{
  process: ProcessEntity
  containers: readonly ProcessContainerRecord[]
}>

export type ProcessSearchProjection = Readonly<{
  processId: string
  reference: string | null
  importerName: string | null
  billOfLading: string | null
  carrier: string | null
}>
