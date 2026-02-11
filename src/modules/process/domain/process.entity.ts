import type { ContainerEntity } from '~/modules/container/domain/container.entity'
import type { ProcessId } from '~/modules/container/domain/value-objects/process-id.vo'
import { type ProcessBrand, toProcessBrand } from '~/modules/process/domain/process.types'
import type { CarrierCode } from '~/modules/process/domain/value-objects/carrier-code.vo'
import type { PlannedLocation } from '~/modules/process/domain/value-objects/planned-location.vo'
import type { ProcessReference } from '~/modules/process/domain/value-objects/process-reference.vo'
import type { ProcessSource } from '~/modules/process/domain/value-objects/process-source.vo'

export type ProcessEntityProps = {
  id: ProcessId
  reference: ProcessReference
  origin: PlannedLocation
  destination: PlannedLocation
  carrier: CarrierCode
  billOfLading: string | null
  bookingNumber: string | null
  importerName: string | null
  exporterName: string | null
  referenceImporter: string | null
  product: string | null
  redestinationNumber: string | null
  source: ProcessSource
  createdAt: Date
  updatedAt: Date
}

export type ProcessEntity = ProcessBrand<Readonly<ProcessEntityProps>, 'ProcessEntity'>

export function createProcessEntity(props: ProcessEntityProps): ProcessEntity {
  return Object.freeze(toProcessBrand<Readonly<ProcessEntityProps>, 'ProcessEntity'>({ ...props }))
}
