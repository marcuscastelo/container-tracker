import { safeParseOrDefault } from '~/modules/container-events/infrastructure/persistence/containerEventMappers'
import type { Process, ProcessContainer } from '~/modules/process/domain'
import {
  CarrierSchema,
  OperationTypeSchema,
  PlannedLocation,
  ProcessSourceSchema,
} from '~/modules/process/domain/value-objects'
import type { Database } from '~/shared/supabase/database.types'
import { isRecord } from '~/shared/utils/typeGuards'

type ProcessRow = Database['public']['Tables']['processes']['Row']
type ContainerRow = Database['public']['Tables']['containers']['Row']

// TODO: Replace assertions with safeParseOrDefault using Zod schemas
export const processMappers = {
  rowToProcess(row: ProcessRow): Process {
    return {
      id: String(row.id),
      reference: row.reference == null ? null : String(row.reference),
      operation_type: safeParseOrDefault(row.operation_type, OperationTypeSchema.parse, 'unknown'),
      origin: safeParseOrDefault(row.origin, PlannedLocation.parse, null),
      destination: safeParseOrDefault(row.destination, PlannedLocation.parse, null),
      carrier: safeParseOrDefault(row.carrier, CarrierSchema.parse, null),
      bill_of_lading: row.bill_of_lading == null ? null : String(row.bill_of_lading),
      booking_reference: row.booking_reference == null ? null : String(row.booking_reference),
      source: safeParseOrDefault(row.source, ProcessSourceSchema.parse, 'manual'),
      created_at: new Date(String(row.created_at)),
      updated_at: new Date(String(row.updated_at)),
    } satisfies Process
  },

  rowToContainer(row: ContainerRow): ProcessContainer {
    return {
      id: String(row.id),
      process_id: String(row.process_id),
      container_number: String(row.container_number),
      carrier_code: row.carrier_code == null ? null : String(row.carrier_code),
      container_type: row.container_type == null ? null : String(row.container_type),
      container_size: row.container_size == null ? null : String(row.container_size),
      created_at: new Date(String(row.created_at)),
      removed_at: row.removed_at ? new Date(String(row.removed_at)) : null,
    }
  },
}
