import type {
  InsertProcessRecord,
  UpdateProcessRecord,
} from '~/modules/process/application/process.records'
import { createProcessEntity, type ProcessEntity } from '~/modules/process/domain/process.entity'
import { toCarrierCode } from '~/modules/process/domain/value-objects/carrier-code.vo'
import { toPlannedLocation } from '~/modules/process/domain/value-objects/planned-location.vo'
import { toProcessId } from '~/modules/process/domain/value-objects/process-id.vo'
import { toProcessReference } from '~/modules/process/domain/value-objects/process-reference.vo'
import { toProcessSource } from '~/modules/process/domain/value-objects/process-source.vo'
import type {
  ProcessInsertRow,
  ProcessRow,
  ProcessUpdateRow,
} from '~/modules/process/infrastructure/persistence/process.row'

// Issue URL: https://github.com/marcuscastelo/container-tracker/issues/13
export const processMappers = {
  rowToProcess(row: ProcessRow): ProcessEntity {
    return createProcessEntity({
      id: toProcessId(row.id),
      reference: row.reference ? toProcessReference(row.reference) : null,
      origin: row.origin == null ? null : String(row.origin),
      destination: row.destination == null ? null : String(row.destination),
      carrier: row.carrier ? toCarrierCode(row.carrier) : null,
      billOfLading: row.bill_of_lading == null ? null : String(row.bill_of_lading),
      bookingNumber: row.booking_number == null ? null : String(row.booking_number),
      importerName: row.importer_name == null ? null : String(row.importer_name),
      exporterName: row.exporter_name == null ? null : String(row.exporter_name),
      referenceImporter: row.reference_importer == null ? null : String(row.reference_importer),
      product: row.product == null ? null : String(row.product),
      redestinationNumber:
        row.redestination_number == null ? null : String(row.redestination_number),
      source: toProcessSource(row.source),
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
    })
  },

  insertRecordToRow(record: InsertProcessRecord, nowIso: string): ProcessInsertRow {
    return {
      reference: record.reference,
      origin: record.origin ?? null,
      destination: record.destination ?? null,
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
