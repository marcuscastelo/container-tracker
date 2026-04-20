import { describe, expect, it } from 'vitest'

import type { InsertProcessRecord } from '~/modules/process/application/process.records'
import { processMappers } from '~/modules/process/infrastructure/persistence/process.persistence.mappers'
import type { ProcessRow } from '~/modules/process/infrastructure/persistence/process.row'

describe('process.persistence.mappers', () => {
  const nowIso = '2026-03-02T00:00:00.000Z'

  it('normalizes legacy uppercase source values from rows', () => {
    const row: ProcessRow = {
      id: 'process-1',
      reference: 'REF-1',
      origin: 'Shanghai',
      destination: 'Santos',
      carrier: 'msc',
      bill_of_lading: null,
      booking_number: null,
      booking_reference: null,
      importer_name: null,
      exporter_name: null,
      reference_importer: null,
      depositary: null,
      product: null,
      redestination_number: null,
      source: 'MANUAL',
      client_id: null,
      created_at: nowIso,
      updated_at: nowIso,
      archived_at: null,
      deleted_at: null,
    }

    const entity = processMappers.rowToProcess(row)

    expect(entity.source).toBe('manual')
  })

  it('canonicalizes source casing on insert rows', () => {
    const record: InsertProcessRecord = {
      reference: 'REF-2',
      origin: 'Shanghai',
      destination: 'Santos',
      carrier: 'msc',
      bill_of_lading: null,
      booking_number: null,
      importer_name: null,
      exporter_name: null,
      reference_importer: null,
      depositary: null,
      product: null,
      redestination_number: null,
      source: 'MaNuAl',
    }

    const row = processMappers.insertRecordToRow(record, nowIso)

    expect(row.source).toBe('manual')
  })

  it('canonicalizes source casing on update rows', () => {
    const row = processMappers.updateRecordToRow(
      {
        source: 'MANUAL',
      },
      nowIso,
    )

    expect(row.source).toBe('manual')
  })
})
