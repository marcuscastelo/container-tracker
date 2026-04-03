import type {
  InsertContainerRecord,
  UpdateContainerRecord,
} from '~/modules/container/application/container.repository'
import {
  type ContainerEntity,
  createContainerEntity,
} from '~/modules/container/domain/container.entity'
import { toCarrierCode } from '~/modules/container/domain/identity/carrier-code.vo'
import { toContainerId } from '~/modules/container/domain/identity/container-id.vo'
import { toContainerNumber } from '~/modules/container/domain/identity/container-number.vo'
import { toProcessId } from '~/modules/container/domain/identity/process-id.vo'
import type {
  ContainerInsert,
  ContainerRow,
  ContainerUpdate,
} from '~/modules/container/infrastructure/persistence/container.row'
import { Instant } from '~/shared/time/instant'

export const containerMappers = {
  fromRow: (row: ContainerRow): ContainerEntity =>
    createContainerEntity({
      id: toContainerId(row.id),
      containerNumber: toContainerNumber(row.container_number),
      carrierCode: toCarrierCode(row.carrier_code),
      processId: toProcessId(row.process_id),
      createdAt: Instant.fromIso(row.created_at),
    }),

  toInsert: (container: InsertContainerRecord): ContainerInsert => ({
    carrier_code: container.carrierCode,
    container_number: container.containerNumber,
    process_id: container.processId,
    container_size: null, // TODO: Implement container size and type inference based on events or external data
    // Issue URL: https://github.com/marcuscastelo/container-tracker/issues/9
    container_type: null, // TODO: Implement container size and type inference based on events or external data
    // Issue URL: https://github.com/marcuscastelo/container-tracker/issues/8
  }),

  toUpdate: (container: UpdateContainerRecord): ContainerUpdate => ({
    carrier_code: container.carrierCode,
    container_number: container.containerNumber,
  }),
}
