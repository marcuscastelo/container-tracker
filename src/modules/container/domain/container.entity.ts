import { type ContainerBrand, toContainerBrand } from '~/modules/container/domain/container.types'
import type { CarrierCode } from '~/modules/container/domain/identity/carrier-code.vo'
import type { ContainerId } from '~/modules/container/domain/identity/container-id.vo'
import type { ContainerNumber } from '~/modules/container/domain/identity/container-number.vo'
import type { ProcessId } from '~/modules/container/domain/identity/process-id.vo'

export type ContainerEntityProps = {
  id: ContainerId
  processId: ProcessId
  carrierCode: CarrierCode
  containerNumber: ContainerNumber
  createdAt: Date
}

export type ContainerEntity = ContainerBrand<Readonly<ContainerEntityProps>, 'ContainerEntity'>

export function createContainerEntity(props: ContainerEntityProps): ContainerEntity {
  return Object.freeze(
    toContainerBrand<Readonly<ContainerEntityProps>, 'ContainerEntity'>({ ...props }),
  )
}
