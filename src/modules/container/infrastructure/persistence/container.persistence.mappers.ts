import type {
  InsertContainerRecord,
  UpdateContainerRecord,
} from '~/modules/container/application/container.repository'
import {
  type ContainerCarrierAssignmentMode,
  type ContainerCarrierDetectionSource,
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

function toCarrierAssignmentMode(value: string | null | undefined): ContainerCarrierAssignmentMode {
  return value === 'MANUAL' ? 'MANUAL' : 'AUTO'
}

function toCarrierDetectionSource(
  value: string | null | undefined,
): ContainerCarrierDetectionSource | null {
  if (value === 'process-seed') return value
  if (value === 'auto-detect') return value
  if (value === 'manual-user') return value
  if (value === 'legacy-backfill') return value
  return null
}

export const containerMappers = {
  fromRow: (row: ContainerRow): ContainerEntity =>
    createContainerEntity({
      id: toContainerId(row.id),
      containerNumber: toContainerNumber(row.container_number),
      carrierCode: row.carrier_code ? toCarrierCode(row.carrier_code) : null,
      carrierAssignmentMode: toCarrierAssignmentMode(row.carrier_assignment_mode),
      carrierDetectedAt: row.carrier_detected_at ? new Date(row.carrier_detected_at) : null,
      carrierDetectionSource: toCarrierDetectionSource(row.carrier_detection_source),
      processId: toProcessId(row.process_id),
      createdAt: Instant.fromIso(row.created_at),
    }),

  toInsert: (container: InsertContainerRecord): ContainerInsert => ({
    carrier_code: container.carrierCode,
    carrier_assignment_mode: container.carrierAssignmentMode ?? 'AUTO',
    carrier_detected_at: container.carrierDetectedAt ?? null,
    carrier_detection_source: container.carrierDetectionSource ?? null,
    container_number: container.containerNumber,
    process_id: container.processId,
    container_size: null, // TODO: Implement container size and type inference based on events or external data
    // Issue URL: https://github.com/marcuscastelo/container-tracker/issues/9
    container_type: null, // TODO: Implement container size and type inference based on events or external data
    // Issue URL: https://github.com/marcuscastelo/container-tracker/issues/8
  }),

  toUpdate: (container: UpdateContainerRecord): ContainerUpdate => ({
    carrier_code: container.carrierCode,
    carrier_assignment_mode: container.carrierAssignmentMode,
    carrier_detected_at: container.carrierDetectedAt,
    carrier_detection_source: container.carrierDetectionSource,
    container_number: container.containerNumber,
    container_size: null, // TODO: Implement container size and type inference based on events or external data
    // Issue URL: https://github.com/marcuscastelo/container-tracker/issues/7
    container_type: null, // TODO: Implement container size and type inference based on events or external data
    // Issue URL: https://github.com/marcuscastelo/container-tracker/issues/6
  }),
}
