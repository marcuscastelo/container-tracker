import type {
  InsertProcessRecord,
  UpdateProcessRecord,
} from '~/modules/process/application/process.records'
import { toCarrierCode } from '~/modules/process/domain/identity/carrier-code.vo'
import { toProcessId } from '~/modules/process/domain/identity/process-id.vo'
import { toProcessReference } from '~/modules/process/domain/identity/process-reference.vo'
import { toProcessSource } from '~/modules/process/domain/identity/process-source.vo'
import { createProcessEntity, type ProcessEntity } from '~/modules/process/domain/process.entity'
import type {
  ProcessInsertRow,
  ProcessRow,
  ProcessUpdateRow,
} from '~/modules/process/infrastructure/persistence/process.row'
import { Instant } from '~/shared/time/instant'

function toProcessCarrierMode(value: string | null | undefined): 'AUTO' | 'MANUAL' {
  return value === 'MANUAL' ? 'MANUAL' : 'AUTO'
}

// Issue URL: https://github.com/marcuscastelo/container-tracker/issues/13
export const processMappers = {
  rowToProcess(row: ProcessRow): ProcessEntity {
    return createProcessEntity({
      id: toProcessId(row.id),
      reference: row.reference ? toProcessReference(row.reference) : null,
      origin: row.origin == null ? null : String(row.origin),
      destination: row.destination == null ? null : String(row.destination),
      carrierMode: toProcessCarrierMode(row.carrier_mode),
      defaultCarrierCode: row.default_carrier_code ? toCarrierCode(row.default_carrier_code) : null,
      lastResolvedCarrierCode: row.last_resolved_carrier_code
        ? toCarrierCode(row.last_resolved_carrier_code)
        : null,
      carrierResolvedAt: row.carrier_resolved_at ? new Date(String(row.carrier_resolved_at)) : null,
      carrier:
        (row.default_carrier_code ?? row.carrier)
          ? toCarrierCode(String(row.default_carrier_code ?? row.carrier))
          : null,
      billOfLading: row.bill_of_lading == null ? null : String(row.bill_of_lading),
      bookingNumber: row.booking_number == null ? null : String(row.booking_number),
      importerName: row.importer_name == null ? null : String(row.importer_name),
      exporterName: row.exporter_name == null ? null : String(row.exporter_name),
      referenceImporter: row.reference_importer == null ? null : String(row.reference_importer),
      product: row.product == null ? null : String(row.product),
      redestinationNumber:
        row.redestination_number == null ? null : String(row.redestination_number),
      source: toProcessSource(row.source),
      createdAt: Instant.fromIso(String(row.created_at)),
      updatedAt: Instant.fromIso(String(row.updated_at)),
    })
  },

  insertRecordToRow(record: InsertProcessRecord, nowIso: string): ProcessInsertRow {
    return {
      reference: record.reference,
      origin: record.origin ?? null,
      destination: record.destination ?? null,
      carrier_mode: record.carrier_mode,
      default_carrier_code: record.default_carrier_code,
      last_resolved_carrier_code: record.last_resolved_carrier_code ?? null,
      carrier_resolved_at: record.carrier_resolved_at ?? null,
      carrier: record.carrier,
      bill_of_lading: record.bill_of_lading,
      booking_number: record.booking_number,
      importer_name: record.importer_name,
      exporter_name: record.exporter_name,
      reference_importer: record.reference_importer,
      product: record.product ?? null,
      redestination_number: record.redestination_number ?? null,
      source: record.source,
      created_at: nowIso,
      updated_at: nowIso,
    }
  },

  updateRecordToRow(record: UpdateProcessRecord, nowIso: string): ProcessUpdateRow {
    return {
      ...(record.reference !== undefined ? { reference: record.reference } : {}),
      ...(record.origin !== undefined ? { origin: record.origin ?? null } : {}),
      ...(record.destination !== undefined ? { destination: record.destination ?? null } : {}),
      ...(record.carrier_mode !== undefined ? { carrier_mode: record.carrier_mode } : {}),
      ...(record.default_carrier_code !== undefined
        ? { default_carrier_code: record.default_carrier_code }
        : {}),
      ...(record.last_resolved_carrier_code !== undefined
        ? { last_resolved_carrier_code: record.last_resolved_carrier_code }
        : {}),
      ...(record.carrier_resolved_at !== undefined
        ? { carrier_resolved_at: record.carrier_resolved_at }
        : {}),
      ...(record.carrier !== undefined ? { carrier: record.carrier } : {}),
      ...(record.bill_of_lading !== undefined ? { bill_of_lading: record.bill_of_lading } : {}),
      ...(record.booking_number !== undefined ? { booking_number: record.booking_number } : {}),
      ...(record.importer_name !== undefined ? { importer_name: record.importer_name } : {}),
      ...(record.exporter_name !== undefined ? { exporter_name: record.exporter_name } : {}),
      ...(record.reference_importer !== undefined
        ? { reference_importer: record.reference_importer }
        : {}),
      ...(record.product !== undefined ? { product: record.product ?? null } : {}),
      ...(record.redestination_number !== undefined
        ? { redestination_number: record.redestination_number ?? null }
        : {}),
      ...(record.source !== undefined ? { source: record.source } : {}),
      updated_at: nowIso,
    }
  },
}
