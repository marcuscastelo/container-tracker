import { describe, expect, it } from 'vitest'

import type { InsertProcessRecord } from '~/modules/process/application/process.records'
import { processMappers } from '~/modules/process/infrastructure/persistence/process.persistence.mappers'
import type { ProcessRow } from '~/modules/process/infrastructure/persistence/process.row'

const baseRow: ProcessRow = {
  id: 'process-1',
  reference: 'REF-001',
  origin: 'Los Angeles',
  destination: 'New York',
  carrier: 'MAEU',
  bill_of_lading: 'BOL-123',
  booking_number: 'BOOK-123',
  booking_reference: null,
  importer_name: 'Importer',
  exporter_name: 'Exporter',
  reference_importer: null,
  depositary: null,
  product: null,
  redestination_number: null,
  source: 'manual',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-02T00:00:00.000Z',
  archived_at: null,
  client_id: null,
  deleted_at: null,
}

describe('process.persistence.mappers', () => {
  it('maps valid timestamps to instants', () => {
    const entity = processMappers.rowToProcess(baseRow)

    expect(entity.createdAt.toIsoString()).toBe('2024-01-01T00:00:00.000Z')
    expect(entity.updatedAt.toIsoString()).toBe('2024-01-02T00:00:00.000Z')
  })

  it('throws when created_at is null', () => {
    const row: ProcessRow = { ...baseRow, created_at: null }

    expect(() => processMappers.rowToProcess(row)).toThrow(
      'process persistence mapper: process.created_at is not a valid timestamp: null',
    )
  })

  it('throws when updated_at is malformed', () => {
    const row: ProcessRow = { ...baseRow, updated_at: 'invalid-timestamp' }

    expect(() => processMappers.rowToProcess(row)).toThrow(
      'process persistence mapper: process.updated_at is not a valid timestamp: invalid-timestamp',
    )
  })

  it('maps row to entity preserving explicit depositary semantics', () => {
    const row = {
      ...baseRow,
      id: 'process-row-1',
      reference: 'REF-1',
      origin: 'Shanghai',
      destination: 'Santos',
      carrier: 'msc',
      bill_of_lading: 'BL-1',
      booking_number: 'BOOK-1',
      importer_name: 'Importer Co',
      exporter_name: 'Exporter Co',
      reference_importer: 'IMP-1',
      depositary: '  Santos Brasil  ',
      product: 'Coffee',
      redestination_number: 'RD-1',
      created_at: '2026-04-07T12:00:00.000Z',
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
