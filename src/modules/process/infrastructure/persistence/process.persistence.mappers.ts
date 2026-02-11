import type { Process } from '~/modules/process/domain/process'
import type { ProcessContainer } from '~/modules/process/domain/processStuff'
import {
  CarrierSchema,
  PlannedLocation,
  ProcessSourceSchema,
} from '~/modules/process/domain/value-objects'
import type { Database } from '~/shared/supabase/database.types'
import { safeParseOrDefault } from '~/shared/utils/safeParseOrDefault'

type ProcessRow = Database['public']['Tables']['processes']['Row']
type ContainerRow = Database['public']['Tables']['containers']['Row']

// TODO: Replace assertions with safeParseOrDefault using Zod schemas
// Issue URL: https://github.com/marcuscastelo/container-tracker/issues/13
export const processMappers = {
  rowToProcess(row: ProcessRow): Process {
    return {
      id: String(row.id),
      reference: row.reference == null ? null : String(row.reference),
      origin: safeParseOrDefault(row.origin, PlannedLocation, null),
      destination: safeParseOrDefault(row.destination, PlannedLocation, null),
      carrier: safeParseOrDefault(row.carrier, CarrierSchema, null),
      bill_of_lading: row.bill_of_lading == null ? null : String(row.bill_of_lading),
      booking_number: row.booking_number == null ? null : String(row.booking_number),
      importer_name: row.importer_name == null ? null : String(row.importer_name),
      exporter_name: row.exporter_name == null ? null : String(row.exporter_name),
      reference_importer: row.reference_importer == null ? null : String(row.reference_importer),
      product: row.product == null ? null : String(row.product),
      redestination_number:
        row.redestination_number == null ? null : String(row.redestination_number),
      source: safeParseOrDefault(row.source, ProcessSourceSchema, 'manual'),
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
      // container_type and container_size are LEGACY - not used in domain
      created_at: new Date(String(row.created_at)),
      removed_at: row.removed_at ? new Date(String(row.removed_at)) : null,
    }
  },
}
