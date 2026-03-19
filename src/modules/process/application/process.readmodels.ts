import type { ProcessEntity } from '~/modules/process/domain/process.entity'

export type ProcessContainerRecord = Readonly<{
  id: string
  processId: string
  containerNumber: string
  carrierCode: string | null
  carrierAssignmentMode?: 'AUTO' | 'MANUAL'
  carrierDetectedAt?: Date | null
  carrierDetectionSource?: 'process-seed' | 'auto-detect' | 'manual-user' | 'legacy-backfill' | null
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
