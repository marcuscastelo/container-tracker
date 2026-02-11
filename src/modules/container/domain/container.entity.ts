import { type Brand, toBrand } from '~/modules/container/domain/container.types'
import type { CarrierCode } from '~/modules/container/domain/value-objects/carrier-code.vo'
import type { ContainerId } from '~/modules/container/domain/value-objects/container-id.vo'
import type { ContainerNumber } from '~/modules/container/domain/value-objects/container-number.vo'
import type { ProcessId } from '~/modules/container/domain/value-objects/process-id.vo'

export type ContainerEntityProps = {
  id: ContainerId
  processId: ProcessId
  carrierCode: CarrierCode
  containerNumber: ContainerNumber
  createdAt: Date
}

export type ContainerEntity = Brand<Readonly<ContainerEntityProps>, 'ContainerEntity'>

export function createContainerEntity(props: ContainerEntityProps): ContainerEntity {
  return Object.freeze(toBrand<Readonly<ContainerEntityProps>, 'ContainerEntity'>({ ...props }))
}
