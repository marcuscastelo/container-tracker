import { describe, expect, it } from 'vitest'

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
  product: null,
  redestination_number: null,
  source: 'manual',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-02T00:00:00.000Z',
  archived_at: null,
  client_id: null,
  deleted_at: null,
}

describe('process persistence mappers', () => {
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
})
