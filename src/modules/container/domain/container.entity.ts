import { type ContainerBrand, toContainerBrand } from '~/modules/container/domain/container.types'
import type { CarrierCode } from '~/modules/container/domain/identity/carrier-code.vo'
import type { ContainerId } from '~/modules/container/domain/identity/container-id.vo'
import type { ContainerNumber } from '~/modules/container/domain/identity/container-number.vo'
import type { ProcessId } from '~/modules/container/domain/identity/process-id.vo'
import type { Instant } from '~/shared/time/instant'

export type ContainerCarrierAssignmentMode = 'AUTO' | 'MANUAL'
export type ContainerCarrierDetectionSource =
  | 'process-seed'
  | 'auto-detect'
  | 'manual-user'
  | 'legacy-backfill'

export type ContainerEntityProps = {
  id: ContainerId
  processId: ProcessId
  carrierCode: CarrierCode | null
  carrierAssignmentMode?: ContainerCarrierAssignmentMode
  carrierDetectedAt?: Date | null
  carrierDetectionSource?: ContainerCarrierDetectionSource | null
  containerNumber: ContainerNumber
  createdAt: Instant
}

export type ContainerEntity = ContainerBrand<Readonly<ContainerEntityProps>, 'ContainerEntity'>

export function createContainerEntity(props: ContainerEntityProps): ContainerEntity {
  return Object.freeze(
    toContainerBrand<Readonly<ContainerEntityProps>, 'ContainerEntity'>({
      ...props,
      carrierAssignmentMode: props.carrierAssignmentMode ?? 'AUTO',
      carrierDetectedAt: props.carrierDetectedAt ?? null,
      carrierDetectionSource: props.carrierDetectionSource ?? null,
    }),
  )
}
