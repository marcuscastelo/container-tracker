import type { CarrierCode } from '~/modules/process/domain/identity/carrier-code.vo'
import type { ProcessId } from '~/modules/process/domain/identity/process-id.vo'
import type { ProcessReference } from '~/modules/process/domain/identity/process-reference.vo'
import type { ProcessSource } from '~/modules/process/domain/identity/process-source.vo'
import { type ProcessBrand, toProcessBrand } from '~/modules/process/domain/process.types'
import { normalizeDepositary } from '~/modules/process/domain/process.validation'
import type { Instant } from '~/shared/time/instant'

export type ProcessEntityProps = {
  id: ProcessId
  reference: ProcessReference | null
  origin: string | null
  destination: string | null
  carrier: CarrierCode | null
  billOfLading: string | null
  bookingNumber: string | null
  importerName: string | null
  exporterName: string | null
  referenceImporter: string | null
  depositary: string | null
  product: string | null
  redestinationNumber: string | null
  source: ProcessSource
  createdAt: Instant
  updatedAt: Instant
}

export type ProcessEntity = ProcessBrand<Readonly<ProcessEntityProps>, 'ProcessEntity'>

type CreateProcessEntityInput = Omit<ProcessEntityProps, 'depositary'> & {
  depositary?: string | null
}

export function createProcessEntity(input: CreateProcessEntityInput): ProcessEntity {
  return Object.freeze(
    toProcessBrand<Readonly<ProcessEntityProps>, 'ProcessEntity'>({
      ...input,
      depositary: normalizeDepositary(input.depositary),
    }),
  )
}
