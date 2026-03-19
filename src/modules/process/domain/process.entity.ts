import type { CarrierCode } from '~/modules/process/domain/identity/carrier-code.vo'
import type { ProcessId } from '~/modules/process/domain/identity/process-id.vo'
import type { ProcessReference } from '~/modules/process/domain/identity/process-reference.vo'
import type { ProcessSource } from '~/modules/process/domain/identity/process-source.vo'
import { type ProcessBrand, toProcessBrand } from '~/modules/process/domain/process.types'
import type { Instant } from '~/shared/time/instant'

export type ProcessCarrierMode = 'AUTO' | 'MANUAL'

export type ProcessEntityProps = {
  id: ProcessId
  reference: ProcessReference | null
  origin: string | null
  destination: string | null
  carrierMode?: ProcessCarrierMode
  defaultCarrierCode?: CarrierCode | null
  lastResolvedCarrierCode?: CarrierCode | null
  carrierResolvedAt?: Date | null
  carrier: CarrierCode | null
  billOfLading: string | null
  bookingNumber: string | null
  importerName: string | null
  exporterName: string | null
  referenceImporter: string | null
  product: string | null
  redestinationNumber: string | null
  source: ProcessSource
  createdAt: Instant
  updatedAt: Instant
}

export type ProcessEntity = ProcessBrand<Readonly<ProcessEntityProps>, 'ProcessEntity'>

export function createProcessEntity(input: ProcessEntityProps): ProcessEntity {
  return Object.freeze(
    toProcessBrand<Readonly<ProcessEntityProps>, 'ProcessEntity'>({
      ...input,
      carrierMode:
        input.carrierMode ??
        ((input.defaultCarrierCode ?? input.carrier) === null ? 'AUTO' : 'MANUAL'),
      defaultCarrierCode: input.defaultCarrierCode ?? input.carrier ?? null,
      lastResolvedCarrierCode: input.lastResolvedCarrierCode ?? null,
      carrierResolvedAt: input.carrierResolvedAt ?? null,
    }),
  )
}
