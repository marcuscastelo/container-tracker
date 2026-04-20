import { describe, expect, it } from 'vitest'
import type { InsertProcessRecord } from '~/modules/process/application/process.records'
import { processMappers } from '~/modules/process/infrastructure/persistence/process.persistence.mappers'
import type { ProcessRow } from '~/modules/process/infrastructure/persistence/process.row'

describe('process.persistence.mappers', () => {
  it('maps row to entity preserving explicit depositary semantics', () => {
    const row = {
      archived_at: null,
      bill_of_lading: 'BL-1',
      booking_number: 'BOOK-1',
      booking_reference: null,
      carrier: 'msc',
      client_id: null,
      created_at: '2026-04-07T12:00:00.000Z',
      deleted_at: null,
      destination: 'Santos',
      depositary: '  Santos Brasil  ',
      exporter_name: 'Exporter Co',
      id: 'process-row-1',
      importer_name: 'Importer Co',
      origin: 'Shanghai',
      product: 'Coffee',
      redestination_number: 'RD-1',
      reference: 'REF-1',
      reference_importer: 'IMP-1',
      source: 'manual',
      updated_at: '2026-04-07T12:30:00.000Z',
    } satisfies ProcessRow

    const entity = processMappers.rowToProcess(row)

    expect(entity.destination).toBe('Santos')
    expect(entity.depositary).toBe('Santos Brasil')
  })

  it('maps insert/update records to rows normalizing depositary', () => {
    const nowIso = '2026-04-07T13:00:00.000Z'
    const insertRecord = {
      reference: 'REF-1',
      origin: 'Shanghai',
      destination: 'Santos',
      carrier: 'msc',
      bill_of_lading: null,
      booking_number: null,
      importer_name: null,
      exporter_name: null,
      reference_importer: null,
      depositary: '  Santos Brasil  ',
      product: null,
      redestination_number: null,
      source: 'manual',
    } satisfies InsertProcessRecord

    expect(processMappers.insertRecordToRow(insertRecord, nowIso)).toMatchObject({
      destination: 'Santos',
      depositary: 'Santos Brasil',
      created_at: nowIso,
      updated_at: nowIso,
    })

    expect(
      processMappers.updateRecordToRow(
        {
          depositary: '   ',
        },
        nowIso,
      ),
    ).toEqual({
      depositary: null,
      updated_at: nowIso,
    })
  })
})
